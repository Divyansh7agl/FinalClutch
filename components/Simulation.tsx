
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SimulationMode, QuestionData, ResponseMetric, PerformanceMetrics } from '../types';
import { QUESTIONS, FILLER_WORDS, SCORING } from '../constants';
import PressureMeter from './PressureMeter';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface SimulationProps {
  mode: SimulationMode;
  onComplete: (metrics: PerformanceMetrics) => void;
  onQuit: () => void;
}

const Simulation: React.FC<SimulationProps> = ({ mode, onComplete, onQuit }) => {
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [timeLeft, setTimeLeft] = useState(mode === 'panic' ? 60 : 0);
  const [pressureScore, setPressureScore] = useState(0);

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

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interimTranscript]);


  useEffect(() => {
    if (isListening) {
      lastSpeechActivityRef.current = Date.now();
    }
  }, [transcript, interimTranscript, isListening]);

  useEffect(() => {
    const shuffled = [...QUESTIONS].sort(() => Math.random() - 0.5);
    setQuestions(mode === 'panic' ? shuffled : shuffled.slice(0, 3));
    questionStartRef.current = Date.now();
  }, [mode]);

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

    responsesRef.current.push({
      questionId: questions[currentQuestionIdx]?.id || 'unknown',
      questionText: questions[currentQuestionIdx]?.text || '',
      delay: Math.max(0, delay),
      fillerCount: localFillerCount,
      wordCount: fullText.trim() === '' ? 0 : wordCount,
      transcript: fullText
    });
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

  const nextQuestion = useCallback(() => {
    processResponse();
    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
      resetTranscript();
      questionStartRef.current = Date.now();
      micActivationRef.current = null;
    } else {
      stopListening();
      calculateFinalResults();
    }
  }, [currentQuestionIdx, questions.length, processResponse, calculateFinalResults, stopListening, resetTranscript]);

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
    if (isListening) stopListening();
    else startListening();
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isListening) {
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

      const target = Math.max(0, Math.min(100, currentP));
      setPressureScore(prev => {
        const recovering = fillerMatchCount === 0 && delayOver === 0;
        const base = recovering ? prev * 0.85 : prev * 0.7;
        const next = base + target * (recovering ? 0.15 : 0.3);
        return Math.round(Math.max(0, Math.min(100, next)));
      });
    }, 100);
    return () => clearInterval(interval);
  }, [transcript, interimTranscript, timeLeft, mode, speechStartTime, isListening]);

  if (!supported) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#0a0c10]">
        <h2 className="text-2xl font-black text-red-500 mb-4 uppercase tracking-widest">Incompatible Hardware</h2>
        <p className="text-slate-500 max-w-md">Speech recognition requires a modern biometric interface (Chrome/Edge). Return to base for system upgrade.</p>
        <button onClick={onQuit} className="mt-8 px-10 py-3 bg-white text-black rounded-full uppercase tracking-widest text-[10px] font-black">Abort Session</button>
      </div>
    );
  }

  const isPanicShaking = mode === 'panic' && timeLeft < 10;

  return (
    <div className={`flex flex-col h-full bg-[#0a0c10] relative transition-all duration-500 ${isPanicShaking ? 'bg-red-950/20' : ''}`}>
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        <div className="absolute bottom-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      </div>

      <div className="flex items-center justify-between p-8 relative z-10">
        <button onClick={onQuit} className="text-slate-600 hover:text-white transition-colors font-black uppercase tracking-[0.3em] text-[10px]">Terminate Sim</button>
        <div className={`text-center space-y-1 ${isPanicShaking ? 'animate-shake' : ''}`}>
          <div className={`text-5xl font-black tabular-nums tracking-tighter ${timeLeft < 10 && mode === 'panic' ? 'text-red-500' : 'text-white'}`}>
            {mode === 'panic' ? timeLeft : `${currentQuestionIdx + 1}/3`}
          </div>
          <div className="text-[10px] uppercase font-bold tracking-[0.4em] text-slate-600">
            {mode === 'panic' ? 'Time Remaining' : 'Protocol Progression'}
          </div>
        </div>
        <div className="px-3 py-1 border border-blue-500/20 rounded-md text-[10px] font-black tracking-widest text-blue-500 uppercase">Live.Link</div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-12 px-12 pb-32 overflow-hidden relative z-10 items-center">
        {/* Main Content Area */}
        <div className="lg:col-span-8 flex flex-col justify-center space-y-12">
          <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-1000" key={currentQuestionIdx}>
            <div className="inline-flex items-center space-x-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              <span className="text-blue-500 font-black uppercase tracking-[0.4em] text-[11px]">Neural Challenge Alpha</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-black leading-[1.1] text-white tracking-tight max-w-4xl">
              {questions[currentQuestionIdx]?.text}
            </h2>
          </div>

          {/* Transcript Terminal */}
          <div className={`relative max-w-4xl w-full bg-black/40 border border-white/5 rounded-[2rem] overflow-hidden backdrop-blur-3xl transition-all duration-700 ${isListening ? 'ring-1 ring-blue-500/30' : 'opacity-60 grayscale'}`}>
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
                  <span className="text-blue-500/50 animate-pulse font-black uppercase tracking-widest text-[10px]">Listening for system input...</span>
                )}
                {transcript}
                <span className="text-blue-400 font-bold ml-1"> {interimTranscript}</span>
                {isListening && <span className="inline-block w-2.5 h-5 bg-blue-500 ml-1 animate-pulse align-middle" />}
              </div>
              <div ref={transcriptEndRef} />
            </div>
          </div>
        </div>

        {/* Gauge Area */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center space-y-8 animate-in fade-in slide-in-from-right-4 duration-1000">
          <div className="bg-white/[0.02] border border-white/5 p-12 rounded-[3.5rem] backdrop-blur-2xl shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-blue-500/[0.02] group-hover:bg-blue-500/[0.04] transition-colors" />
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
            className={`p-10 rounded-full transition-all duration-700 transform relative ${isListening
              ? 'bg-red-600 scale-110 rotate-90 shadow-[0_0_80px_rgba(220,38,38,0.5)]'
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

          {mode === 'viva' && (
            <button
              onClick={nextQuestion}
              className="group px-12 py-5 bg-white text-black font-black rounded-2xl transition-all hover:bg-blue-500 hover:text-white uppercase tracking-[0.3em] text-[11px] shadow-2xl flex items-center"
            >
              {currentQuestionIdx === questions.length - 1 ? 'Complete Protocol' : 'Submit response'}
              <svg className="w-4 h-4 ml-3 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
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
