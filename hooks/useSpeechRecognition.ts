
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
  const [supported, setSupported] = useState(true);

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

    recognition.onstart = () => {
      console.log('Speech recognition started');
      setIsListening(true);
      speechStartRef.current = null;
      setSpeechStartTime(null);
    };

    recognition.onresult = (event: any) => {
      console.log('Speech recognition result received', event);
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
        alert('Microphone access denied. Please enable microphone permissions.');
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      setIsListening(false);
      if (shouldRestartRef.current) {
        try {
          recognition.start();
        } catch (e) {
          console.error('Restart error:', e);
        }
      }
    };

    recognitionRef.current = recognition;
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        console.log('Manually starting speech recognition');
        setTranscript('');
        setInterimTranscript('');
        shouldRestartRef.current = true;
        recognitionRef.current.start();
      } catch (e) {
        console.error("Start error:", e);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      console.log('Manually stopping speech recognition');
      shouldRestartRef.current = false;
      recognitionRef.current.stop();
    }
  }, [isListening]);

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
