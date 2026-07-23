import { useCallback } from "react";

/** Safari below 14.1 only exposes the prefixed constructor. */
type WebkitAudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

function createAudioContext(): AudioContext {
  const Ctor = window.AudioContext ?? (window as WebkitAudioWindow).webkitAudioContext;
  if (!Ctor) throw new Error("Web Audio API is not supported in this browser");
  return new Ctor();
}

export const useSounds = () => {
  const playCorrect = useCallback(() => {
    const audioContext = createAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
    oscillator.type = "sine";
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  }, []);

  const playIncorrect = useCallback(() => {
    const audioContext = createAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(200, audioContext.currentTime + 0.15);
    oscillator.type = "sine";
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  }, []);

  return { playCorrect, playIncorrect };
};
