import { useCallback } from "react";
import { useAnalytics } from "@repo/analytics";

export const useSpeak = () => {
  const { track } = useAnalytics();
  return useCallback(async (text: string, lang: string) => {
    track("tts_play", { lang });
    const cleanText = text.replace(/[/]/g, " ").replace(/[-]/g, " ").replace(/\(.*?\)/g, " ");

    const fallback = () => {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = lang === "spanish" ? "es-ES" : "fr-FR";
      window.speechSynthesis.speak(utterance);
    };

    try {
      const response = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText, lang }),
      });
      if (!response.ok) throw new Error("Failed to fetch audio");
      const data = await response.json();
      const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
      await audio.play().catch(fallback);
    } catch {
      fallback();
    }
  }, [track]);
};
