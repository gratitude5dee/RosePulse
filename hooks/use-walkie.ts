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

export type WalkiePermissionState = "unknown" | "granted" | "denied" | "unsupported";

export function useWalkie({ lang, onAutoStop }: UseWalkieOptions = {}) {
  const [speechSupported, setSpeechSupported] = useState(true);
  const [micSupported, setMicSupported] = useState(true);
  const [secureContext, setSecureContext] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [permissionState, setPermissionState] = useState<WalkiePermissionState>("unknown");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const autoStopRef = useRef<number | null>(null);
  const elapsedRef = useRef<number | null>(null);
  const lastSampleAtRef = useRef(0);

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
        setSpeechSupported(false);
      }
      setInterimTranscript("");
    };
    recognition.onend = () => {
      setInterimTranscript("");
    };
    setSpeechSupported(true);
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
  }, [sampleAudio, stopAudio]);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      recognitionRef.current?.abort();
    }
    setIsRecording(false);
    stopAudio();
    if (autoStopRef.current !== null) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (elapsedRef.current !== null) {
      window.clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }
  }, [stopAudio]);

  const start = useCallback(async () => {
    if (isRecording || !micSupported) return;
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
    setSegments([]);
    setInterimTranscript("");
  }, []);

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
    supported: speechSupported,
    speechSupported,
    micSupported,
    secureContext,
    isRecording,
    permissionState,
    segments,
    interimTranscript,
    transcript,
    audioLevel,
    elapsedSeconds,
    start,
    stop,
    clearTranscript,
    setSegments
  };
}
