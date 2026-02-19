
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
  const recognitionRef = useRef<any>(null);
  const speechStartRef = useRef<number | null>(null);
  const shouldRestartRef = useRef(false);
  const isListeningRef = useRef(false); // ref to avoid stale closure issues
  const [supported, setSupported] = useState(true);

  // Keep the ref in sync with state
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

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
      console.log('Speech recognition started');
      isListeningRef.current = true;
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
          const newTranscript = prev + (prev ? ' ' : '') + finalTranscript.trim();
          console.log('Updated Final Transcript:', newTranscript);
          return newTranscript;
        });
      }
      setInterimTranscript(currentInterim);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);

      if (event.error === 'not-allowed') {
        shouldRestartRef.current = false;
        alert('Microphone access denied. Please enable microphone permissions in your browser and reload the page.');
      } else if (event.error === 'no-speech') {
        // no-speech is not fatal — onend will fire and restart if needed
        console.warn('No speech detected, will restart if active.');
      } else if (event.error === 'aborted') {
        // Aborted intentionally or by browser — don't restart
        shouldRestartRef.current = false;
      } else {
        // network or other transient errors — allow restart
        console.warn('Transient speech error, will attempt restart.');
      }

      isListeningRef.current = false;
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log('Speech recognition ended. shouldRestart:', shouldRestartRef.current);
      isListeningRef.current = false;
      setIsListening(false);

      if (shouldRestartRef.current) {
        // Small delay to avoid rapid-fire restarts
        setTimeout(() => {
          if (shouldRestartRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.error('Restart error:', e);
            }
          }
        }, 200);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldRestartRef.current = false;
      try {
        recognition.stop();
      } catch (_) { }
    };
  }, []);

  const startListening = useCallback(() => {
    // Use ref to avoid stale closure — check the real-time listening state
    if (recognitionRef.current && !isListeningRef.current) {
      try {
        console.log('Manually starting speech recognition');
        setTranscript('');
        setInterimTranscript('');
        speechStartRef.current = null;
        setSpeechStartTime(null);
        shouldRestartRef.current = true;
        recognitionRef.current.start();
      } catch (e: any) {
        // InvalidStateError means already started — that's fine
        if (e?.name !== 'InvalidStateError') {
          console.error('Start error:', e);
        }
      }
    } else {
      console.log('startListening skipped — already listening or no recognition instance');
    }
  }, []); // no deps — uses refs only

  const stopListening = useCallback(() => {
    // Use ref to avoid stale closure
    if (recognitionRef.current && isListeningRef.current) {
      console.log('Manually stopping speech recognition');
      shouldRestartRef.current = false;
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error('Stop error:', e);
      }
    } else {
      // Even if we think it's not listening, ensure shouldRestart is cleared
      shouldRestartRef.current = false;
    }
  }, []); // no deps — uses refs only

  const resetTranscript = useCallback(() => {
    console.log('Resetting transcript state');
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
    supported
  };
};
