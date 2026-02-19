
import { useState, useEffect, useRef, useCallback } from 'react';

interface UseSpeechRecognitionReturn {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  speechStartTime: number | null;
  supported: boolean;
}

export const useSpeechRecognition = (): UseSpeechRecognitionReturn => {
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechStartTime, setSpeechStartTime] = useState<number | null>(null);
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const speechStartRef = useRef<number | null>(null);
  const shouldRestartRef = useRef(false);

  // isListeningRef is updated SYNCHRONOUSLY inside onstart/onend handlers
  // so it is ALWAYS accurate — never stale unlike a React state ref
  const isListeningRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('[STT] Started');
      isListeningRef.current = true;   // synchronous — never stale
      setIsListening(true);
      speechStartRef.current = null;
      setSpeechStartTime(null);
    };

    recognition.onresult = (event: any) => {
      if (!speechStartRef.current && event.results.length > 0) {
        speechStartRef.current = Date.now();
        setSpeechStartTime(speechStartRef.current);
      }

      let finalTranscript = '';
      let currentInterim = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          currentInterim += result[0].transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(prev => {
          const updated = prev + (prev ? ' ' : '') + finalTranscript.trim();
          console.log('[STT] Transcript:', updated);
          return updated;
        });
      }
      setInterimTranscript(currentInterim);
    };

    recognition.onerror = (event: any) => {
      console.error('[STT] Error:', event.error);

      if (event.error === 'not-allowed') {
        shouldRestartRef.current = false;
        alert('Microphone access denied. Please enable microphone permissions in your browser and reload.');
      } else if (event.error === 'aborted') {
        // Intentionally aborted — don't restart
        shouldRestartRef.current = false;
      }
      // For 'no-speech', 'network', etc. — onend will fire and attempt restart if needed

      isListeningRef.current = false;
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log('[STT] Ended. shouldRestart:', shouldRestartRef.current);
      isListeningRef.current = false;
      setIsListening(false);

      if (shouldRestartRef.current) {
        setTimeout(() => {
          if (shouldRestartRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.error('[STT] Restart error:', e);
            }
          }
        }, 200);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldRestartRef.current = false;
      try { recognition.stop(); } catch (_) { }
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListeningRef.current) {
      // Already listening — just ensure shouldRestart is set
      shouldRestartRef.current = true;
      return;
    }

    try {
      console.log('[STT] Starting');
      shouldRestartRef.current = true;
      recognitionRef.current.start();
    } catch (e: any) {
      if (e?.name !== 'InvalidStateError') {
        console.error('[STT] Start error:', e);
      }
    }
  }, []); // stable — uses only refs

  const stopListening = useCallback(() => {
    // Always clear the restart flag so onend doesn't restart
    shouldRestartRef.current = false;

    if (!recognitionRef.current) return;

    if (isListeningRef.current) {
      console.log('[STT] Stopping');
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error('[STT] Stop error:', e);
      }
    }
  }, []); // stable — uses only refs

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    speechStartRef.current = null;
    setSpeechStartTime(null);
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
    speechStartTime,
    supported,
  };
};
