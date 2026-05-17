"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TranscriptSegment } from "@/lib/types";

interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface BrowserSpeechRecognitionConstructor {
  new (): BrowserSpeechRecognition;
}

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface BrowserSpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item: (index: number) => BrowserSpeechRecognitionAlternative;
  [index: number]: BrowserSpeechRecognitionAlternative;
}

interface BrowserSpeechRecognitionResultList {
  readonly length: number;
  item: (index: number) => BrowserSpeechRecognitionResult;
  [index: number]: BrowserSpeechRecognitionResult;
}

interface BrowserSpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: BrowserSpeechRecognitionResultList;
}

interface BrowserSpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechWindow extends Window {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitAudioContext?: {
    new (contextOptions?: AudioContextOptions): AudioContext;
  };
}

interface UseWalkieOptions {
  lang?: string;
  onAutoStop?: () => void;
}

interface TranscriptionResponse {
  text: string;
  model?: string;
}

export type WalkiePermissionState = "unknown" | "granted" | "denied" | "unsupported";

const AUDIO_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/ogg;codecs=opus"
];

const TRANSCRIPTION_FAILURE_COPY = "Transcription failed. Try again or type the note before saving.";

function getSupportedRecordingMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }

  return AUDIO_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function getAudioExtension(mimeType: string) {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("aac")) return "aac";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

function isTranscriptionResponse(value: unknown): value is TranscriptionResponse {
  return Boolean(value && typeof value === "object" && "text" in value && typeof value.text === "string");
}

function readApiError(value: unknown) {
  if (!value || typeof value !== "object" || !("error" in value)) return null;
  const error = value.error;
  return typeof error === "string" ? error : null;
}

export function useWalkie({ lang, onAutoStop }: UseWalkieOptions = {}) {
  const [speechSupported, setSpeechSupported] = useState(true);
  const [serverTranscriptionSupported, setServerTranscriptionSupported] = useState(true);
  const [micSupported, setMicSupported] = useState(true);
  const [secureContext, setSecureContext] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [transcriptionModel, setTranscriptionModel] = useState<string | undefined>();
  const [transcribedAt, setTranscribedAt] = useState<string | undefined>();
  const [lastRecordingDurationSeconds, setLastRecordingDurationSeconds] = useState<number | undefined>();
  const [permissionState, setPermissionState] = useState<WalkiePermissionState>("unknown");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const lastRecordingRef = useRef<Blob | null>(null);
  const speechSupportedRef = useRef(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const autoStopRef = useRef<number | null>(null);
  const elapsedRef = useRef<number | null>(null);
  const lastSampleAtRef = useRef(0);
  const transcriptionRequestRef = useRef(0);

  useEffect(() => {
    speechSupportedRef.current = speechSupported;
  }, [speechSupported]);

  useEffect(() => {
    setServerTranscriptionSupported(typeof MediaRecorder !== "undefined");
  }, []);

  useEffect(() => {
    const canUseMic = Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext;
    setSecureContext(window.isSecureContext);
    setMicSupported(canUseMic);
    if (!canUseMic) {
      setPermissionState("unsupported");
    }

    const win = window as SpeechWindow;
    const Recognition = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechSupported(false);
      speechSupportedRef.current = false;
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang ?? navigator.language ?? "en-US";
    recognition.onresult = (event) => {
      let interim = "";
      const finalSegments: TranscriptSegment[] = [];
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript.trim() ?? "";
        if (!text) continue;
        if (result.isFinal) {
          finalSegments.push({
            id: crypto.randomUUID(),
            text,
            at: new Date().toISOString(),
            isFinal: true
          });
        } else {
          interim += `${text} `;
        }
      }
      if (finalSegments.length > 0) {
        setSegments((current) => [...current, ...finalSegments]);
      }
      setInterimTranscript(interim.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        speechSupportedRef.current = false;
        setSpeechSupported(false);
      }
      setInterimTranscript("");
    };
    recognition.onend = () => {
      setInterimTranscript("");
    };
    setSpeechSupported(true);
    speechSupportedRef.current = true;
    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [lang]);

  const stopAudio = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const audioContext = audioContextRef.current;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close().catch(() => undefined);
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    lastSampleAtRef.current = 0;
    setAudioLevel(0);
  }, []);

  const clearTimers = useCallback(() => {
    if (autoStopRef.current !== null) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (elapsedRef.current !== null) {
      window.clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }
  }, []);

  const sampleAudio = useCallback((time?: number) => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    if (time === undefined || time - lastSampleAtRef.current >= 50) {
      lastSampleAtRef.current = time ?? performance.now();
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) {
        const centered = (value - 128) / 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / data.length);
      setAudioLevel(Math.min(1, rms * 4));
    }
    frameRef.current = requestAnimationFrame(sampleAudio);
  }, []);

  const transcribeRecording = useCallback(
    async (recording: Blob) => {
      if (recording.size === 0) {
        setTranscriptionError("No audio was captured. Hold the mic and try again.");
        return;
      }

      lastRecordingRef.current = recording;
      const requestId = transcriptionRequestRef.current + 1;
      transcriptionRequestRef.current = requestId;
      setIsTranscribing(true);
      setTranscriptionError(null);

      const mimeType = recording.type || "audio/webm";
      const formData = new FormData();
      formData.append("audio", recording, `walkie-${Date.now()}.${getAudioExtension(mimeType)}`);
      formData.append("lang", lang ?? navigator.language ?? "en-US");

      try {
        const response = await fetch("/api/walkie/transcribe", {
          method: "POST",
          body: formData
        });
        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(readApiError(payload) ?? TRANSCRIPTION_FAILURE_COPY);
        }

        if (!isTranscriptionResponse(payload)) {
          throw new Error("Transcription returned an unexpected response. Type the note before saving.");
        }

        const text = payload.text.trim();
        if (!text) {
          throw new Error("No speech was detected. Type the note before saving.");
        }

        if (transcriptionRequestRef.current !== requestId) return;
        setTranscriptionModel(payload.model);
        setTranscribedAt(new Date().toISOString());
        setSegments((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            text,
            at: new Date().toISOString(),
            isFinal: true
          }
        ]);
        setInterimTranscript("");
        setTranscriptionError(null);
      } catch (error) {
        if (transcriptionRequestRef.current === requestId) {
          setTranscriptionError(error instanceof Error ? error.message : TRANSCRIPTION_FAILURE_COPY);
        }
      } finally {
        if (transcriptionRequestRef.current === requestId) {
          setIsTranscribing(false);
        }
      }
    },
    [lang]
  );

  const beginMediaRecording = useCallback((stream: MediaStream) => {
    if (typeof MediaRecorder === "undefined") {
      setServerTranscriptionSupported(false);
      return;
    }

    try {
      const mimeType = getSupportedRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        setServerTranscriptionSupported(false);
        setTranscriptionError("Audio recording failed. Type the note before saving.");
      };
      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setServerTranscriptionSupported(true);
    } catch {
      mediaRecorderRef.current = null;
      recordedChunksRef.current = [];
      setServerTranscriptionSupported(false);
    }
  }, []);

  const finishMediaRecording = useCallback(
    (shouldTranscribe: boolean) => {
      const recorder = mediaRecorderRef.current;
      mediaRecorderRef.current = null;

      if (!recorder) {
        stopAudio();
        return;
      }

      const finalizeRecording = () => {
        const mimeType = recorder.mimeType || recordedChunksRef.current[0]?.type || "audio/webm";
        const recording = new Blob(recordedChunksRef.current, { type: mimeType });
        recordedChunksRef.current = [];
        if (startedAtRef.current) {
          setLastRecordingDurationSeconds(Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)));
        }
        stopAudio();
        if (shouldTranscribe) {
          void transcribeRecording(recording);
        }
      };

      recorder.onstop = finalizeRecording;
      try {
        if (recorder.state === "inactive") {
          finalizeRecording();
          return;
        }
        recorder.requestData();
        recorder.stop();
      } catch {
        recordedChunksRef.current = [];
        stopAudio();
        if (shouldTranscribe) {
          setTranscriptionError(TRANSCRIPTION_FAILURE_COPY);
        }
      }
    },
    [stopAudio, transcribeRecording]
  );

  const requestMic = useCallback(async () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setPermissionState("unsupported");
      setMicSupported(false);
      return false;
    }

    const win = window as SpeechWindow;
    const AudioContextConstructor = window.AudioContext ?? win.webkitAudioContext;
    if (!AudioContextConstructor) {
      setPermissionState("unsupported");
      setMicSupported(false);
      return false;
    }

    try {
      stopAudio();

      const preferredAudio: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      };
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: preferredAudio });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      streamRef.current = stream;
      const audioContext = new AudioContextConstructor();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      beginMediaRecording(stream);
      setPermissionState("granted");
      setMicSupported(true);
      lastSampleAtRef.current = 0;
      frameRef.current = requestAnimationFrame(sampleAudio);
      return true;
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setPermissionState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unsupported");
      setMicSupported(name !== "NotAllowedError" && name !== "SecurityError" ? false : true);
      stopAudio();
      return false;
    }
  }, [beginMediaRecording, sampleAudio, stopAudio]);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      recognitionRef.current?.abort();
    }
    setIsRecording(false);
    clearTimers();
    finishMediaRecording(!speechSupportedRef.current && serverTranscriptionSupported);
  }, [clearTimers, finishMediaRecording, serverTranscriptionSupported]);

  const start = useCallback(async () => {
    if (isRecording || !micSupported) return;
    setTranscriptionError(null);
    const hasMic = await requestMic();
    if (!hasMic) return;
    startedAtRef.current = Date.now();
    setElapsedSeconds(0);
    setIsRecording(true);
    if (speechSupported && recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch {
        try {
          recognitionRef.current.abort();
          recognitionRef.current.start();
        } catch {
          speechSupportedRef.current = false;
          setSpeechSupported(false);
        }
      }
    }
    elapsedRef.current = window.setInterval(() => {
      if (startedAtRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 250);
    autoStopRef.current = window.setTimeout(() => {
      stop();
      onAutoStop?.();
    }, 60_000);
  }, [isRecording, micSupported, onAutoStop, requestMic, speechSupported, stop]);

  const clearTranscript = useCallback(() => {
    transcriptionRequestRef.current += 1;
    lastRecordingRef.current = null;
    setIsTranscribing(false);
    setTranscriptionError(null);
    setTranscriptionModel(undefined);
    setTranscribedAt(undefined);
    setLastRecordingDurationSeconds(undefined);
    setSegments([]);
    setInterimTranscript("");
  }, []);

  const retryTranscription = useCallback(() => {
    const recording = lastRecordingRef.current;
    if (!recording) {
      setTranscriptionError("No recording is available to retry. Hold the mic and try again.");
      return;
    }
    void transcribeRecording(recording);
  }, [transcribeRecording]);

  useEffect(() => {
    const stopForPageLifecycle = () => stop();
    const stopWhenHidden = () => {
      if (document.visibilityState !== "visible") {
        stop();
      }
    };

    document.addEventListener("visibilitychange", stopWhenHidden);
    window.addEventListener("pagehide", stopForPageLifecycle);
    return () => {
      document.removeEventListener("visibilitychange", stopWhenHidden);
      window.removeEventListener("pagehide", stopForPageLifecycle);
      stop();
    };
  }, [stop]);

  const transcript = useMemo(
    () => [...segments.map((segment) => segment.text), interimTranscript].filter(Boolean).join(" "),
    [interimTranscript, segments]
  );

  return {
    supported: speechSupported || serverTranscriptionSupported,
    speechSupported,
    serverTranscriptionSupported,
    micSupported,
    secureContext,
    isRecording,
    isTranscribing,
    transcriptionError,
    transcriptionModel,
    transcribedAt,
    lastRecordingDurationSeconds,
    permissionState,
    segments,
    interimTranscript,
    transcript,
    audioLevel,
    elapsedSeconds,
    start,
    stop,
    clearTranscript,
    retryTranscription,
    setSegments
  };
}
