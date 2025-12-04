import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { sanitizeForSpeech } from "@/lib/speechUtils";

export type SpeechMode = "both" | "ai" | "user";

export type SpeechSettings = {
  enabled: boolean;
  autoplay: boolean;
  mode: SpeechMode;
  voiceURI?: string | null;
  rate: number;
  pitch: number;
  volume: number;
};

export type SpeechContextType = {
  settings: SpeechSettings;
  setSettings: (s: Partial<SpeechSettings>) => void;
  voices: SpeechSynthesisVoice[];
  speak: (text: string, opts?: Partial<SpeechSettings & { id?: string }>) => void;
  cancel: () => void;
  isSpeaking: boolean;
  currentUtteranceId: string | null;
};

const defaultSettings: SpeechSettings = {
  enabled: false,
  autoplay: false,
  mode: "both",
  voiceURI: null,
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
};

const SpeechContext = createContext<SpeechContextType | undefined>(undefined);

export const useSpeech = () => {
  const ctx = useContext(SpeechContext);
  if (!ctx) throw new Error("useSpeech must be used within SpeechProvider");
  return ctx;
};

export const SpeechProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettingsInternal] = useState<SpeechSettings>(() => {
    try {
      const raw = localStorage.getItem("speechSettings");
      if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
    } catch (e) {}
    return defaultSettings;
  });

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentUtteranceId, setCurrentUtteranceId] = useState<string | null>(null);

  useEffect(() => {
    // Load voices when available
    function loadVoices() {
      const vs = (window.speechSynthesis?.getVoices() || []) as SpeechSynthesisVoice[];
      setVoices(vs);
    }

    loadVoices();
    // Some browsers load voices asynchronously
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
  }, []);

  const setSettings = (s: Partial<SpeechSettings>) => {
    setSettingsInternal((prev) => {
      const next = { ...prev, ...s };
      try {
        localStorage.setItem("speechSettings", JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const cancel = () => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  };

  const speak = (text: string, opts?: Partial<SpeechSettings & { id?: string }>) => {
    if (!window.speechSynthesis) return;

    const combined = { ...settings, ...opts } as SpeechSettings;
    if (!combined.enabled) return;

    cancel();

    let utterText = sanitizeForSpeech(text);
    // Basic sanitization: remove code fences + reduce whitespace
    utterText = utterText.replace(/```[\s\S]*?```/g, ""); // remove code blocks
    utterText = utterText.replace(/`([^`]+)`/g, "$1"); // inline code
    utterText = utterText.replace(/\[(.*?)\]\((.*?)\)/g, "$1"); // markdown links -> link text
    // strip HTML tags just in case
    utterText = utterText.replace(/<[^>]+>/g, "");
    // Trim and collapse whitespace
    utterText = utterText.replace(/\s+/g, " ").trim();

    const utt = new SpeechSynthesisUtterance(utterText);

    // Choose voice
    if (combined.voiceURI) {
      const matched = voices.find((v) => v.voiceURI === combined.voiceURI || v.name === combined.voiceURI);
      if (matched) utt.voice = matched;
    }

    utt.rate = combined.rate || 1;
    utt.pitch = combined.pitch || 1;
    utt.volume = combined.volume ?? 1;

    utt.onstart = () => {
      setIsSpeaking(true);
      if (opts && (opts as any).id) setCurrentUtteranceId((opts as any).id || null);
    };
    utt.onend = () => {
      setIsSpeaking(false);
      setCurrentUtteranceId(null);
    };
    utt.onerror = (e) => {
      console.error("TTS error", e);
      setIsSpeaking(false);
      setCurrentUtteranceId(null);
    };

    window.speechSynthesis.speak(utt);
  };

  const value = useMemo(
    () => ({ settings, setSettings, voices, speak, cancel, isSpeaking, currentUtteranceId }),
    [settings, voices, isSpeaking, currentUtteranceId]
  );

  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>;
};
