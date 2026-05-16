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
}

interface UseWalkieOptions {
  lang?: string;
  onAutoStop?: () => void;
}

export type WalkiePermissionState = "unknown" | "granted" | "denied" | "unsupported";

export function useWalkie({ lang, onAutoStop }: UseWalkieOptions = {}) {
  const [supported, setSupported] = useState(true);
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

  useEffect(() => {
    const win = window as SpeechWindow;
    const Recognition = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!Recognition) {
      setSupported(false);
      setPermissionState("unsupported");
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
        setPermissionState("denied");
      }
      setIsRecording(false);
    };
    recognition.onend = () => {
      setIsRecording(false);
      setInterimTranscript("");
    };
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
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  const sampleAudio = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const value of data) {
      const centered = (value - 128) / 128;
      sum += centered * centered;
    }
    const rms = Math.sqrt(sum / data.length);
    setAudioLevel(Math.min(1, rms * 4));
    frameRef.current = requestAnimationFrame(sampleAudio);
  }, []);

  const requestMic = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionState("unsupported");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioContextConstructor = window.AudioContext;
      const audioContext = new AudioContextConstructor();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      setPermissionState("granted");
      frameRef.current = requestAnimationFrame(sampleAudio);
      return true;
    } catch {
      setPermissionState("denied");
      return false;
    }
  }, [sampleAudio]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
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
    if (!supported || !recognitionRef.current) return;
    const hasMic = await requestMic();
    if (!hasMic) return;
    startedAtRef.current = Date.now();
    setElapsedSeconds(0);
    setIsRecording(true);
    try {
      recognitionRef.current.start();
    } catch {
      recognitionRef.current.stop();
      recognitionRef.current.start();
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
  }, [onAutoStop, requestMic, stop, supported]);

  const clearTranscript = useCallback(() => {
    setSegments([]);
    setInterimTranscript("");
  }, []);

  useEffect(() => stop, [stop]);

  const transcript = useMemo(
    () => [...segments.map((segment) => segment.text), interimTranscript].filter(Boolean).join(" "),
    [interimTranscript, segments]
  );

  return {
    supported,
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
