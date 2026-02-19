
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SimulationMode, QuestionData, ResponseMetric, PerformanceMetrics, CustomContext } from '../types';
import { QUESTIONS, FILLER_WORDS, SCORING } from '../constants';
import PressureMeter from './PressureMeter';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { generateAIQuestions, generateNextAIQuestion } from '../src/utils/aiFeedback';
import { speakWithGroq, stopGroqTTS } from '../src/utils/groqTTS';

interface SimulationProps {
  mode: SimulationMode;
  customContext?: CustomContext;
  onComplete: (metrics: PerformanceMetrics) => void;
  onQuit: () => void;
}

const Simulation: React.FC<SimulationProps> = ({ mode, customContext, onComplete, onQuit }) => {
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [timeLeft, setTimeLeft] = useState(mode === 'panic' ? 60 : 0);
  const [pressureScore, setPressureScore] = useState(0);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [aiInterviewHistory, setAiInterviewHistory] = useState<{ question: string; answer: string }[]>([]);

  const {
    transcript,
    interimTranscript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
    speechStartTime,
    supported
  } = useSpeechRecognition();

  const responsesRef = useRef<ResponseMetric[]>([]);
  const questionStartRef = useRef<number>(Date.now());
  const micActivationRef = useRef<number | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const lastSpeechActivityRef = useRef<number>(Date.now());
  const hasInitializedRef = useRef(false);

  const isListeningRef = useRef(isListening);
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Browser SpeechSynthesis fallback — used only if Groq TTS fails
  const speakWithBrowser = useCallback((text: string, onStart: () => void, onEnd: () => void) => {
    window.speechSynthesis.cancel();

    const doSpeak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const preferred = [
        'Google UK English Female', 'Google UK English Male',
        'Microsoft Aria Online (Natural) - English (United States)',
        'Microsoft Guy Online (Natural) - English (United States)',
        'Google US English',
      ];
      for (const name of preferred) {
        const match = voices.find(v => v.name === name);
        if (match) { utterance.voice = match; break; }
      }
      utterance.rate = 0.92;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.onstart = onStart;
      utterance.onend = onEnd;
      utterance.onerror = () => onEnd();
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      doSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        doSpeak();
      };
    }
  }, []);

  const speakQuestion = useCallback(async (text: string) => {
    if (!text) return;

    // Stop any current playback
    stopGroqTTS();
    window.speechSynthesis?.cancel();

    if (isListeningRef.current) stopListening();

    const onStart = () => {
      setIsAISpeaking(true);
      if (isListeningRef.current) stopListening();
    };

    const onEnd = () => {
      setIsAISpeaking(false);
      setTimeout(() => {
        if (micActivationRef.current === null) {
          micActivationRef.current = Date.now();
        }
        startListening();
      }, 300);
    };

    // Try Groq TTS first (high quality Orpheus/PlayAI voice)
    const usedGroq = await speakWithGroq(text, onStart, onEnd, () => {
      setIsAISpeaking(false);
    });

    // Fall back to browser SpeechSynthesis if Groq TTS unavailable
    if (!usedGroq) {
      console.log('[TTS] Falling back to browser SpeechSynthesis');
      speakWithBrowser(text, onStart, onEnd);
    }
  }, [stopListening, startListening, speakWithBrowser]);

  useEffect(() => {
    return () => {
      stopGroqTTS();
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interimTranscript]);


  useEffect(() => {
    if (isListening) {
      lastSpeechActivityRef.current = Date.now();
    }
  }, [transcript, interimTranscript, isListening]);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const initQuestions = async () => {
      setIsLoadingQuestions(true);
      try {
        let qs: QuestionData[] = [];
        const combinedContext = mode === 'custom' && customContext
          ? `Interview for the role of ${customContext.role} on the topic of ${customContext.topic}`
          : "High-Pressure Executive Leadership Interview";

        const difficulty = customContext?.difficulty || 'medium';

        if (mode === 'ai-interview' || mode === 'custom') {
          // Both AI and Custom modes start with one generated question and continue conversationally
          const firstQuestion = await generateNextAIQuestion([], combinedContext, 'groq', difficulty);
          qs = [{ id: `ai-start-${Date.now()}`, text: firstQuestion }];
        } else {
          const aiQuestions = await generateAIQuestions(combinedContext, mode === 'panic' ? 10 : 3, 'groq', difficulty);
          if (aiQuestions && aiQuestions.length > 0) {
            qs = aiQuestions;
          } else {
            const shuffled = [...QUESTIONS].sort(() => Math.random() - 0.5);
            qs = mode === 'panic' ? shuffled : shuffled.slice(0, 3);
          }
        }
        setQuestions(qs);

        // Speak the first question if in AI or Custom mode
        if ((mode === 'ai-interview' || mode === 'custom') && qs.length > 0) {
          setTimeout(() => speakQuestion(qs[0].text), 1500);
        }
      } catch (err) {
        console.error("AI question generation failed:", err);
        const shuffled = [...QUESTIONS].sort(() => Math.random() - 0.5);
        setQuestions(mode === 'panic' ? shuffled : shuffled.slice(0, 3));
      } finally {
        setIsLoadingQuestions(false);
        questionStartRef.current = Date.now();
      }
    };

    initQuestions();
  }, [mode, customContext]);

  const processResponse = useCallback(() => {
    // Delay is now relative to mic activation, or 0 if mic never opened
    const startRef = micActivationRef.current || Date.now();
    const delay = speechStartTime ? speechStartTime - startRef : (Date.now() - startRef);
    const fullText = transcript + " " + interimTranscript;
    const wordCount = fullText.trim().split(/\s+/).length;

    let localFillerCount = 0;
    FILLER_WORDS.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = fullText.match(regex);
      if (matches) localFillerCount += matches.length;
    });

    const response = {
      questionId: questions[currentQuestionIdx]?.id || 'unknown',
      questionText: questions[currentQuestionIdx]?.text || '',
      delay: Math.max(0, delay),
      fillerCount: localFillerCount,
      wordCount: fullText.trim() === '' ? 0 : wordCount,
      transcript: fullText
    };

    responsesRef.current.push(response);
    return response;
  }, [currentQuestionIdx, questions, transcript, interimTranscript, speechStartTime]);

  const calculateFinalResults = useCallback(() => {
    const responses = responsesRef.current;
    if (responses.length === 0) {
      onComplete({ clarity: 0, composure: 0, structure: 0, confidence: 0, fillerCount: 0, avgDelay: 0, transcript: '', responses: [] });
      return;
    }

    const totalFillers = responses.reduce((acc, r) => acc + r.fillerCount, 0);
    const avgDelay = responses.reduce((acc, r) => acc + r.delay, 0) / responses.length;
    const avgWordCount = responses.reduce((acc, r) => acc + r.wordCount, 0) / responses.length;

    const combinedTranscriptLower = responses.map(r => r.transcript).join(' ').trim().toLowerCase();
    const logicMarkers = ['because', 'however', 'therefore', 'example', 'specifically', 'consequently', 'furthermore', 'nevertheless', 'result', 'since'];
    let logicHits = 0;
    logicMarkers.forEach(marker => {
      const regex = new RegExp(`\\b${marker}\\b`, 'gi');
      const matches = combinedTranscriptLower.match(regex);
      if (matches) logicHits += matches.length;
    });

    let clarity = 100 - (totalFillers * 8);
    let composure = 100 - (avgDelay / 150);

    // Structure (Logic) now considers word count AND logical transitions
    const wordCountScore = avgWordCount > SCORING.MIN_WORD_COUNT ? 70 : (avgWordCount / SCORING.MIN_WORD_COUNT) * 70;
    const transitionScore = Math.min(30, logicHits * 5); // Reward up to 30 points for logical markers
    let structure = wordCountScore + transitionScore;

    clarity = Math.max(20, Math.min(100, clarity));
    composure = Math.max(20, Math.min(100, composure));
    structure = Math.max(20, Math.min(100, structure));

    let basePressure = (100 - clarity) * 0.4 + (100 - composure) * 0.4 + (100 - structure) * 0.2;
    if (mode === 'panic') basePressure *= SCORING.PANIC_MULTIPLIER;
    const confidence = Math.max(0, Math.min(100, 100 - basePressure));

    const combinedTranscriptFinal = responses.map(r => r.transcript).join(' ').trim();

    onComplete({
      clarity: Math.round(clarity),
      composure: Math.round(composure),
      structure: Math.round(structure),
      confidence: Math.round(confidence),
      fillerCount: totalFillers,
      avgDelay: Math.round(avgDelay),
      transcript: combinedTranscriptFinal,
      responses: responses
    });
  }, [mode, onComplete]);

  const nextQuestion = useCallback(async () => {
    const lastResponse = processResponse();
    stopListening();

    const isConversational = mode === 'ai-interview' || mode === 'custom';
    const limit = isConversational ? 5 : questions.length;

    if (isConversational && currentQuestionIdx < limit - 1) {
      setIsAIThinking(true);
      const newHistory = [...aiInterviewHistory, { question: questions[currentQuestionIdx].text, answer: lastResponse.transcript }];
      setAiInterviewHistory(newHistory);

      try {
        const combinedContext = mode === 'custom' && customContext
          ? `Interview for the role of ${customContext.role} on the topic of ${customContext.topic}`
          : "General Professional Interview";

        const difficulty = customContext?.difficulty || 'medium';

        const nextQ = await generateNextAIQuestion(newHistory, combinedContext, 'groq', difficulty);
        const nextQuestionData: QuestionData = { id: `ai-${Date.now()}`, text: nextQ };

        setQuestions(prev => [...prev, nextQuestionData]);
        setCurrentQuestionIdx(prev => prev + 1);
        resetTranscript();
        questionStartRef.current = Date.now();
        micActivationRef.current = null;

        // Speak the next question
        speakQuestion(nextQ);
      } catch (e) {
        console.error("Dynamic question error", e);
        calculateFinalResults();
      } finally {
        setIsAIThinking(false);
      }
    } else if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
      resetTranscript();
      questionStartRef.current = Date.now();
      micActivationRef.current = null;
    } else {
      calculateFinalResults();
    }
  }, [currentQuestionIdx, questions, processResponse, calculateFinalResults, stopListening, resetTranscript, mode, aiInterviewHistory, speakQuestion, customContext]);

  const endSessionEarly = useCallback(() => {
    processResponse();
    stopListening();
    calculateFinalResults();
  }, [processResponse, stopListening, calculateFinalResults]);

  useEffect(() => {
    let interval: any;
    if (mode === 'panic' && isListening && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (mode === 'panic' && isListening && timeLeft === 0) {
      stopListening();
      calculateFinalResults();
    }
    return () => clearInterval(interval);
  }, [mode, timeLeft, calculateFinalResults, stopListening, isListening]);

  useEffect(() => {
    if (mode === 'panic' && isListening && timeLeft > 0 && timeLeft % 15 === 0 && timeLeft !== 60) {
      nextQuestion();
    }
  }, [mode, timeLeft, nextQuestion, isListening]);

  const toggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      if (micActivationRef.current === null) {
        micActivationRef.current = Date.now();
      }
      startListening();
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isListening || isAISpeaking || isAIThinking) {
        setPressureScore(0);
        return;
      }
      let currentP = 0;
      const combinedText = (transcript + " " + interimTranscript).toLowerCase();

      const delayMs = speechStartTime
        ? speechStartTime - questionStartRef.current
        : Date.now() - questionStartRef.current;
      const delayOver = Math.max(0, delayMs - SCORING.DELAY_THRESHOLD_MS);
      const delayPenalty = Math.min(35, delayOver / 140);
      currentP += delayPenalty;

      let fillerMatchCount = 0;
      FILLER_WORDS.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = combinedText.match(regex);
        if (matches) fillerMatchCount += matches.length;
      });
      currentP += Math.min(30, fillerMatchCount * 4);

      if (isListening) {
        const inactivityMs = Date.now() - lastSpeechActivityRef.current;
        if (inactivityMs > 1200) {
          currentP += Math.min(35, (inactivityMs - 1200) / 90);
        }
      }

      if (mode === 'panic') {
        if (timeLeft < 10) currentP += 30;
        currentP *= 1.2;
      }

      if (mode === 'ai-interview') {
        currentP *= 0.8; // AI mode is more conversational, less about raw pressure
      }

      const target = Math.max(0, Math.min(100, currentP));
      setPressureScore(prev => {
        const recovering = fillerMatchCount === 0 && delayOver === 0;
        const base = recovering ? prev * 0.85 : prev * 0.7;
        const next = base + target * (recovering ? 0.15 : 0.3);
        return Math.round(Math.max(0, Math.min(100, next)));
      });
    }, 100);
    return () => clearInterval(interval);
  }, [transcript, interimTranscript, timeLeft, mode, speechStartTime, isListening, isAISpeaking, isAIThinking]);

  if (isLoadingQuestions) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#0a0c10]">
        <div className="relative">
          <div className="w-24 h-24 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 border-r-2 border-l-2 border-blue-400 rounded-full animate-spin-reverse opacity-50"></div>
          </div>
        </div>
        <h2 className="mt-8 text-2xl font-black text-blue-500 uppercase tracking-widest animate-pulse">
          {mode === 'ai-interview' ? 'Initializing Neural Link' : 'Generating AI Challenges'}
        </h2>
        <p className="mt-4 text-slate-500 font-mono text-xs uppercase tracking-widest">
          {mode === 'ai-interview' ? 'Syncing with conversational AI...' : 'Constructing psychological pressure scenarios...'}
        </p>
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#0a0c10]">
        <h2 className="text-2xl font-black text-red-500 mb-4 uppercase tracking-widest">Incompatible Hardware</h2>
        <p className="text-slate-500 max-w-md">Speech recognition requires a modern biometric interface (Chrome/Edge). Return to base for system upgrade.</p>
        <button onClick={onQuit} className="mt-8 px-10 py-3 bg-white text-black rounded-full uppercase tracking-widest text-[10px] font-black">Abort Session</button>
      </div>
    );
  }

  const isConversational = mode === 'ai-interview' || mode === 'custom';
  const isAIActive = mode === 'ai-interview';
  const isCustomActive = mode === 'custom';
  const isPanicShaking = mode === 'panic' && timeLeft < 10;
  const themeColor = isAIActive ? 'emerald' : isCustomActive ? 'orange' : 'blue';

  return (
    <div className={`flex flex-col h-full bg-[#0a0c10] relative transition-all duration-500 ${isPanicShaking ? 'bg-red-950/20' : ''}`}>
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        <div className="absolute bottom-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        {isAIActive && (
          <div className="absolute inset-0 bg-emerald-500/5 transition-opacity duration-1000" />
        )}
        {isCustomActive && (
          <div className="absolute inset-0 bg-orange-500/5 transition-opacity duration-1000" />
        )}
      </div>

      <div className="flex items-center justify-between p-8 relative z-10">
        <button onClick={onQuit} className="text-slate-600 hover:text-white transition-colors font-black uppercase tracking-[0.3em] text-[10px]">Terminate Sim</button>
        <div className={`text-center space-y-1 ${isPanicShaking ? 'animate-shake' : ''}`}>
          <div className={`text-5xl font-black tabular-nums tracking-tighter ${timeLeft < 10 && mode === 'panic' ? 'text-red-500' : 'text-white'}`}>
            {mode === 'panic' ? timeLeft : `${currentQuestionIdx + 1}/${isConversational ? 5 : 3}`}
          </div>
          <div className="text-[10px] uppercase font-bold tracking-[0.4em] text-slate-600">
            {mode === 'panic' ? 'Time Remaining' : 'Protocol Progression'}
          </div>
        </div>
        <div className={`px-3 py-1 border rounded-md text-[10px] font-black tracking-widest uppercase ${isAIActive ? 'border-emerald-500/20 text-emerald-500' : isCustomActive ? 'border-orange-500/20 text-orange-500' : 'border-blue-500/20 text-blue-500'}`}>
          {isAIActive ? 'Neural.Feedback.Active' : isCustomActive ? 'Custom.Protocol.Active' : 'Live.Link'}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 px-12 pb-16 overflow-y-auto relative z-10">
        {/* Main Content Area */}
        <div className="lg:col-span-8 flex flex-col justify-start pt-8 space-y-8">
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-1000" key={currentQuestionIdx}>
            <div className="inline-flex items-center space-x-2">
              <span className={`w-1.5 h-1.5 rounded-full ${isAIActive ? 'bg-emerald-500' : isCustomActive ? 'bg-orange-500' : 'bg-blue-500'}`} />
              <span className={`${isAIActive ? 'text-emerald-500' : isCustomActive ? 'text-orange-500' : 'text-blue-500'} font-black uppercase tracking-[0.4em] text-[11px]`}>
                {isAIActive ? 'AI Conversational Agent' : isCustomActive ? `Neural Expert: ${customContext?.role}` : 'Neural Challenge Alpha'}
              </span>
            </div>
            <h2 className={`text-3xl md:text-4xl lg:text-5xl font-black leading-[1.2] text-white tracking-tight max-w-4xl break-words ${isAISpeaking ? 'animate-pulse' : ''}`}>
              {isAIThinking ? (
                <span className="text-slate-500 text-2xl italic">Analyzing response and generating follow-up...</span>
              ) : (
                questions[currentQuestionIdx]?.text
              )}
            </h2>
            {isAISpeaking && (
              <div className={`flex items-center space-x-2 ${isAIActive ? 'text-emerald-500' : isCustomActive ? 'text-orange-500' : 'text-blue-500'} font-bold text-[10px] uppercase tracking-widest`}>
                <span className="flex space-x-1">
                  <span className={`w-1 h-3 ${isAIActive ? 'bg-emerald-500' : isCustomActive ? 'bg-orange-500' : 'bg-blue-500'} animate-bounce`} style={{ animationDelay: '0ms' }} />
                  <span className={`w-1 h-3 ${isAIActive ? 'bg-emerald-500' : isCustomActive ? 'bg-orange-500' : 'bg-blue-500'} animate-bounce`} style={{ animationDelay: '100ms' }} />
                  <span className={`w-1 h-3 ${isAIActive ? 'bg-emerald-500' : isCustomActive ? 'bg-orange-500' : 'bg-blue-500'} animate-bounce`} style={{ animationDelay: '200ms' }} />
                </span>
                <span>AI is speaking...</span>
              </div>
            )}
          </div>

          {/* Transcript Terminal */}
          <div className={`relative max-w-4xl w-full bg-black/40 border border-white/5 rounded-[2rem] overflow-hidden backdrop-blur-3xl transition-all duration-700 ${isListening ? `ring-1 ${isAIActive ? 'ring-emerald-500/30' : isCustomActive ? 'ring-orange-500/30' : 'ring-blue-500/30'}` : 'opacity-60 grayscale'}`}>
            <div className="absolute top-0 left-0 right-0 p-4 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-slate-700'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Audio Telemetry Stream</span>
              </div>
              <span className="text-[10px] font-mono text-slate-600">ID: CLUTCH-SIM-TX</span>
            </div>
            <div className="p-8 h-48 overflow-y-auto font-mono text-base pt-16 scrollbar-hide">
              <div className="text-slate-400 leading-relaxed italic">
                {!transcript && !interimTranscript && isListening && (
                  <span className={`${isAIActive ? 'text-emerald-500/50' : isCustomActive ? 'text-orange-500/50' : 'text-blue-500/50'} animate-pulse font-black uppercase tracking-widest text-[10px]`}>
                    Listening for system input...
                  </span>
                )}
                {transcript}
                <span className={`${isAIActive ? 'text-emerald-400' : isCustomActive ? 'text-orange-400' : 'text-blue-400'} font-bold ml-1`}> {interimTranscript}</span>
                {isListening && <span className={`inline-block w-2.5 h-5 ml-1 animate-pulse align-middle ${isAIActive ? 'bg-emerald-500' : isCustomActive ? 'bg-orange-500' : 'bg-blue-500'}`} />}
              </div>
              <div ref={transcriptEndRef} />
            </div>
          </div>
        </div>

        {/* Gauge Area */}
        <div className="lg:col-span-4 flex flex-col items-center justify-start pt-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-1000">
          <div className="bg-white/[0.02] border border-white/5 p-12 rounded-[3.5rem] backdrop-blur-2xl shadow-2xl relative overflow-hidden group">
            <div className={`absolute inset-0 transition-colors ${isAIActive ? 'bg-emerald-500/[0.02] group-hover:bg-emerald-500/[0.04]' : isCustomActive ? 'bg-orange-500/[0.02] group-hover:bg-orange-500/[0.04]' : 'bg-blue-500/[0.02] group-hover:bg-blue-500/[0.04]'}`} />
            <PressureMeter score={pressureScore} />
            <div className="mt-4 text-center">
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.5em]">Stress Threshold Gauge</p>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center space-y-8 z-20">
        <div className="flex items-center space-x-8">
          <button
            onClick={toggleMic}
            disabled={isAISpeaking || isAIThinking}
            className={`p-10 rounded-full transition-all duration-700 transform relative ${(isAISpeaking || isAIThinking)
              ? 'bg-slate-800 opacity-50 cursor-not-allowed'
              : isListening
                ? 'bg-red-600 scale-110 rotate-90 shadow-[0_0_80px_rgba(220,38,38,0.5)]'
                : isAIActive
                  ? 'bg-emerald-600 hover:scale-105 shadow-[0_0_40px_rgba(16,185,129,0.4)]'
                  : isCustomActive
                    ? 'bg-orange-600 hover:scale-105 shadow-[0_0_40px_rgba(249,115,22,0.4)]'
                    : 'bg-blue-600 hover:scale-105 shadow-[0_0_40px_rgba(37,99,235,0.4)]'
              }`}
          >
            <div className="absolute inset-0 rounded-full bg-white/10 animate-ping opacity-20 pointer-events-none" />
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isListening ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 18.5a6 6 0 006-6v-5a6 6 0 00-12 0v5a6 6 0 006 6z M19 12.5a7 7 0 01-14 0" />
              )}
            </svg>
          </button>

          {(mode === 'viva' || isConversational) && (
            <button
              onClick={nextQuestion}
              disabled={isAISpeaking || isAIThinking || (!transcript && !interimTranscript)}
              className={`group px-12 py-5 font-black rounded-2xl transition-all uppercase tracking-[0.3em] text-[11px] shadow-2xl flex items-center ${isAISpeaking || isAIThinking || (!transcript && !interimTranscript)
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : isAIActive
                  ? 'bg-white text-black hover:bg-emerald-500 hover:text-white'
                  : isCustomActive
                    ? 'bg-white text-black hover:bg-orange-500 hover:text-white'
                    : 'bg-white text-black hover:bg-blue-500 hover:text-white'
                }`}
            >
              {isAIThinking ? 'AI Thinking...' : (currentQuestionIdx === (isConversational ? 4 : questions.length - 1) ? 'Complete Protocol' : 'Submit response')}
              {!isAIThinking && (
                <svg className="w-4 h-4 ml-3 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              )}
            </button>
          )}

          {mode === 'panic' && (
            <button
              onClick={endSessionEarly}
              className="group px-10 py-4 border border-red-500/40 text-red-400 font-black rounded-2xl transition-all hover:bg-red-500 hover:text-white uppercase tracking-[0.3em] text-[10px] shadow-xl"
            >
              End Session
            </button>
          )}
        </div>

        <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.8em]">Encrypted Session Link: STABLE</p>
      </div>
    </div>
  );
};

export default Simulation;
