
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SimulationMode, QuestionData, ResponseMetric, PerformanceMetrics, CustomContext } from '../types';
import { QUESTIONS, FILLER_WORDS, SCORING } from '../constants';
import Logo from './Logo';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { generateAIQuestions, generateNextAIQuestion, generateFollowupChallenge, getLastApiError } from '../src/utils/aiFeedback';
import CameraFeed from './CameraFeed';
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
  const [interviewStage, setInterviewStage] = useState<'lobby' | 'interview' | 'candidate-questions'>('lobby');
  const [isPausePending, setIsPausePending] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [aiInterviewHistory, setAiInterviewHistory] = useState<{ question: string; answer: string }[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const isConversational = mode === 'ai-interview' || mode === 'custom' || mode === 'followup';
  const isAIActive = mode === 'ai-interview';
  const isCustomActive = mode === 'custom';
  const isFollowupActive = mode === 'followup';

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
  const lastSpeechActivityRef = useRef<number>(Date.now());
  const autoSubmitTimerRef = useRef<number | null>(null);
  const responseSubmittingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const sessionStartedAtRef = useRef(Date.now());
  const MAX_AI_SESSION_SECONDS = 25 * 60;
  const MIN_AI_ROUNDS = 6;
  const MAX_AI_ROUNDS = 12;



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

    // Stop any current playback and mic immediately
    stopGroqTTS();
    window.speechSynthesis?.cancel();
    stopListening();

    // Mark AI as speaking RIGHT NOW — before the network fetch — so the
    // mic button stays disabled during the Groq TTS loading window
    setIsAISpeaking(true);

    const onStart = () => {
      // AI is already marked as speaking; mic is already stopped
      setIsAISpeaking(true);
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

    // If TTS errors out (audio playback failure), still start the mic
    // so the user can respond — don't leave the session stuck.
    const onError = () => {
      setIsAISpeaking(false);
      setTimeout(() => {
        if (micActivationRef.current === null) {
          micActivationRef.current = Date.now();
        }
        startListening();
      }, 300);
    };

    // Try Groq TTS first (high quality Orpheus/PlayAI voice)
    const usedGroq = await speakWithGroq(text, onStart, onEnd, onError);

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
        const resumePrompt = customContext?.resumeContext?.resumeText
          ? ` Candidate resume context: ${customContext.resumeContext.resumeText}`
          : '';

        // Build a context string that reflects the actual mode so Groq doesn't
        // generate the same executive-leadership questions every single time.
        let combinedContext: string;
        if (mode === 'custom' && customContext) {
          combinedContext = `Interview for the role of ${customContext.role} on the topic of ${customContext.topic}.${resumePrompt}`;
        } else if (mode === 'ai-interview') {
          combinedContext = `General software / tech internship or entry-level interview.${resumePrompt}`;
        } else if (mode === 'viva') {
          combinedContext = `Technical viva-style interview for an engineering or CS internship candidate.${resumePrompt}`;
        } else if (mode === 'panic') {
          combinedContext = `Rapid-fire technical and behavioural questions for a fresher applying to tech internships.${resumePrompt}`;
        } else {
          combinedContext = `Entry-level job or internship interview.${resumePrompt}`;
        }

        const difficulty = customContext?.difficulty || 'medium';

        if (mode === 'ai-interview' || mode === 'custom') {
          const firstDecision = await generateNextAIQuestion([], combinedContext, 'groq', difficulty);
          const firstQuestion = firstDecision.question;
          const apiErr = getLastApiError();
          if (apiErr) {
            console.warn(`[ClutchAI] AI Interview question generation fell back to offline mode (${apiErr.message}, status ${apiErr.status}, code ${apiErr.reasonCode}).`);
          }
          qs = [{ id: `ai-start-${Date.now()}`, text: firstQuestion }];
        } else if (mode === 'followup') {
          const firstQuestion = await generateFollowupChallenge('', '', difficulty);
          qs = [{ id: `followup-start-${Date.now()}`, text: firstQuestion }];
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
    const totalWords = responses.reduce((acc, r) => acc + r.wordCount, 0);
    const fillerRate = totalWords > 0 ? totalFillers / totalWords : 0;
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

    const speechMechanics = Math.max(0, Math.min(100,
      100
      - Math.min(45, fillerRate * 1000)
      - Math.min(35, Math.max(0, avgDelay - 1500) / 180)
    ));
    let clarity = Math.max(20, Math.min(100, speechMechanics));
    let composure = Math.max(20, Math.min(100, 100 - (Math.max(0, avgDelay - 1000) / 120)));

    // Structure (Logic) now considers word count AND logical transitions
    const wordCountScore = avgWordCount > SCORING.MIN_WORD_COUNT ? 70 : (avgWordCount / SCORING.MIN_WORD_COUNT) * 70;
    const transitionScore = Math.min(30, logicHits * 5); // Reward up to 30 points for logical markers
    let structure = wordCountScore + transitionScore;

    clarity = Math.max(20, Math.min(100, clarity));
    composure = Math.max(20, Math.min(100, composure));
    structure = Math.max(20, Math.min(100, structure));

    let basePressure = (100 - clarity) * 0.25 + (100 - composure) * 0.45 + (100 - structure) * 0.3;
    if (mode === 'panic') basePressure *= SCORING.PANIC_MULTIPLIER;
    const confidence = Math.max(0, Math.min(100, 100 - basePressure));

    const combinedTranscriptFinal = responses.map(r => r.transcript).join(' ').trim();

    onComplete({
      clarity: Math.round(clarity),
      composure: Math.round(composure),
      structure: Math.round(structure),
      confidence: Math.round(confidence),
      fillerCount: totalFillers,
      fillerRate: Number(fillerRate.toFixed(4)),
      totalWords,
      speechMechanics: Math.round(speechMechanics),
      avgDelay: Math.round(avgDelay),
      transcript: combinedTranscriptFinal,
      responses: responses
    });
  }, [mode, onComplete]);

  useEffect(() => {
    if (!isConversational) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStartedAtRef.current) / 1000);
      setElapsedSeconds(elapsed);
      if (isAIActive && elapsed >= MAX_AI_SESSION_SECONDS) {
        stopListening();
        calculateFinalResults();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isConversational, isAIActive, stopListening, calculateFinalResults]);

  const advanceQuestion = useCallback(async () => {
    const lastResponse = processResponse();
    stopListening();

    const isConversational = mode === 'ai-interview' || mode === 'custom' || mode === 'followup';
    const limit = isAIActive ? MAX_AI_ROUNDS : isConversational ? 5 : questions.length;

    if (currentQuestionIdx >= limit - 1 && mode !== 'panic') {
      resetTranscript();
      setInterviewStage('candidate-questions');
      speakQuestion("That's all the questions I have. Before we finish, what questions would you like to ask me?");
      return;
    }

    if (isConversational && currentQuestionIdx < limit - 1) {
      setIsAIThinking(true);
      // Build history immediately using captured values (before any awaits)
      const newHistory = [
        ...aiInterviewHistory,
        { question: questions[currentQuestionIdx].text, answer: lastResponse.transcript }
      ];
      setAiInterviewHistory(newHistory);

      try {
        const difficulty = customContext?.difficulty || 'medium';

        let nextQ: string;
        if (mode === 'followup') {
          nextQ = await generateFollowupChallenge(
            questions[currentQuestionIdx].text,
            lastResponse.transcript,
            difficulty
          );
        } else {
          // Build context for ai-interview mode using resume context if available
          const resumeSuffix = customContext?.resumeContext?.resumeText
            ? `. Candidate resume context: ${customContext.resumeContext.resumeText}`
            : '';
          const combinedContext = mode === 'custom' && customContext
            ? `Interview for the role of ${customContext.role} on the topic of ${customContext.topic}${resumeSuffix}`
            : `General Professional Interview${resumeSuffix}`;
          const nextDecision = await generateNextAIQuestion(newHistory, combinedContext, 'groq', difficulty);
          if (isAIActive && newHistory.length >= MIN_AI_ROUNDS && nextDecision.shouldEnd) {
            calculateFinalResults();
            return;
          }
          nextQ = nextDecision.question;
        }
        const nextQuestionData: QuestionData = { id: `ai-${Date.now()}`, text: nextQ };

        // Reset transcript and refs BEFORE speaking so the new listening
        // session starts clean when TTS finishes
        resetTranscript();
        questionStartRef.current = Date.now();
        micActivationRef.current = null;

        setQuestions(prev => [...prev, nextQuestionData]);
        setCurrentQuestionIdx(prev => prev + 1);

        // Speak the next question — onEnd will auto-start the mic
        speakQuestion(nextQ);
      } catch (e) {
        console.error("Dynamic question error", e);
        calculateFinalResults();
      } finally {
        setIsAIThinking(false);
      }
    } else if (currentQuestionIdx < questions.length - 1) {
      // Non-conversational (viva/panic) — advance to next pre-loaded question
      setCurrentQuestionIdx(prev => prev + 1);
      resetTranscript();
      questionStartRef.current = Date.now();
      micActivationRef.current = null;
    } else calculateFinalResults();
  }, [currentQuestionIdx, questions, processResponse, calculateFinalResults, stopListening, resetTranscript, mode, aiInterviewHistory, speakQuestion, customContext]);

  const nextQuestion = useCallback(() => {
    if (responseSubmittingRef.current) return;
    responseSubmittingRef.current = true;
    void advanceQuestion().finally(() => {
      responseSubmittingRef.current = false;
    });
  }, [advanceQuestion]);

  useEffect(() => {
    if (autoSubmitTimerRef.current !== null) {
      window.clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }

    const answerText = `${transcript} ${interimTranscript}`.trim();
    const shouldAutoSubmit = interviewStage === 'interview'
      && mode !== 'panic'
      && isListening
      && !isAISpeaking
      && !isAIThinking
      && Boolean(answerText);

    if (!shouldAutoSubmit) return;

    setIsPausePending(true);
    autoSubmitTimerRef.current = window.setTimeout(() => {
      autoSubmitTimerRef.current = null;
      setIsPausePending(false);
      if (isListening && !isAISpeaking && !isAIThinking && `${transcript} ${interimTranscript}`.trim()) {
        nextQuestion();
      }
    }, 4000);

    return () => {
      if (autoSubmitTimerRef.current !== null) {
        window.clearTimeout(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = null;
      }
      setIsPausePending(false);
    };
  }, [transcript, interimTranscript, interviewStage, mode, isListening, isAISpeaking, isAIThinking, nextQuestion]);

  const endSessionEarly = useCallback(() => {
    if (responseSubmittingRef.current) return;
    responseSubmittingRef.current = true;
    processResponse();
    stopListening();
    calculateFinalResults();
    responseSubmittingRef.current = false;
  }, [processResponse, stopListening, calculateFinalResults]);

  const startInterview = useCallback(() => {
    setInterviewStage('interview');
    sessionStartedAtRef.current = Date.now();
    questionStartRef.current = Date.now();
    micActivationRef.current = null;
    const opening = `Hi, thanks for joining me today. I'll ask you a few questions about your experience and problem-solving approach. Take a moment to think before answering. ${questions[0]?.text || ''}`;
    if (isAIActive || isCustomActive || isFollowupActive) {
      speakQuestion(opening);
    } else {
      startListening();
    }
  }, [questions, isAIActive, isCustomActive, isFollowupActive, speakQuestion, startListening]);

  const finishCandidateQuestions = useCallback(() => {
    stopListening();
    resetTranscript();
    calculateFinalResults();
  }, [stopListening, resetTranscript, calculateFinalResults]);

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
      // When it's not the user's turn, decay smoothly to 0
      if (!isListening || isAISpeaking || isAIThinking) {
        setPressureScore(prev => Math.round(prev * 0.88));
        return;
      }

      const now = Date.now();
      const combinedText = (transcript + ' ' + interimTranscript).toLowerCase().trim();
      const words = combinedText.split(/\s+/).filter(Boolean);
      const wordCount = words.length;
      let currentP = 0;

      // ── Factor 1: Silence / inactivity (0–50 pts) ──────────────────────────
      // How long has the mic been open with no detected speech?
      // Grace period: 1.5 s before we start penalising.
      // Max pressure reached at 8 s of continuous silence.
      const silenceMs = now - lastSpeechActivityRef.current;
      const SILENCE_GRACE = 1500;
      const SILENCE_MAX_MS = 8000;
      if (silenceMs > SILENCE_GRACE) {
        const over = silenceMs - SILENCE_GRACE;
        currentP += Math.min(50, (over / (SILENCE_MAX_MS - SILENCE_GRACE)) * 50);
      }

      // ── Factor 2: Filler density (0–30 pts) ────────────────────────────────
      // Measures fillers as a fraction of total words spoken.
      // A ratio of 0 = 0 pts; a ratio of 20 %+ = full 30 pts.
      // This degrades gradually as the user speaks more words cleanly,
      // instead of staying stuck at a permanent raw count.
      if (wordCount >= 4) {
        let fillerCount = 0;
        FILLER_WORDS.forEach(word => {
          const reg = new RegExp(`\\b${word}\\b`, 'gi');
          const m = combinedText.match(reg);
          if (m) fillerCount += m.length;
        });
        const fillerRatio = fillerCount / wordCount; // 0.0 → ~0.3
        currentP += Math.min(30, fillerRatio * 150);  // 20 % ratio → 30 pts
      }

      // ── Factor 3: Initial response wait (0–20 pts) ──────────────────────────
      // Penalises hesitation BEFORE the user starts speaking.
      // Once speechStartTime is set (first word detected) this factor is 0 —
      // early hesitation no longer haunts the rest of the answer.
      if (!speechStartTime) {
        const waitMs = now - (micActivationRef.current ?? questionStartRef.current);
        const WAIT_GRACE = 2000;
        const WAIT_MAX_MS = 7000;
        if (waitMs > WAIT_GRACE) {
          const over = waitMs - WAIT_GRACE;
          currentP += Math.min(20, (over / (WAIT_MAX_MS - WAIT_GRACE)) * 20);
        }
      }

      // ── Mode modifiers ───────────────────────────────────────────────────────
      if (mode === 'panic') {
        currentP *= 1.25;
        if (timeLeft < 10) currentP += 20; // urgency spike in final 10 s
      } else if (mode === 'followup') {
        currentP *= 1.1;  // slightly elevated — adversarial context
      } else if (mode === 'ai-interview' || mode === 'custom') {
        currentP *= 0.85; // conversational — less raw pressure
      }

      const target = Math.max(0, Math.min(100, currentP));

      // ── Asymmetric smoothing ─────────────────────────────────────────────────
      // Rises quickly (feels responsive to stress),
      // falls slowly (recovery feels earned, not instant).
      setPressureScore(prev => {
        const alpha = target > prev ? 0.40 : 0.12;
        return Math.round(Math.max(0, Math.min(100, prev + alpha * (target - prev))));
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
          {mode === 'ai-interview' ? 'Initializing Neural Link' : mode === 'followup' ? 'Calibrating Adversary' : 'Generating AI Challenges'}
        </h2>
        <p className="mt-4 text-slate-500 font-mono text-xs uppercase tracking-widest">
          {mode === 'ai-interview' ? 'Syncing with conversational AI...' : mode === 'followup' ? 'Preparing hostile interrogation mode...' : 'Constructing psychological pressure scenarios...'}
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

  if (interviewStage === 'lobby') {
    const interviewerRole = customContext?.role || (mode === 'viva' ? 'Technical Interviewer' : 'Senior Hiring Manager');
    const interviewType = mode === 'panic' ? 'Rapid-response practice interview' : mode === 'followup' ? 'Deep-dive technical interview' : 'Structured practice interview';
    return (
      <div className="flex items-center justify-center h-full p-6 bg-[#0a0c10] relative overflow-hidden">
        <div className="absolute inset-0 bg-emerald-500/[0.03] pointer-events-none" />
        <div className="relative z-10 w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 md:p-12 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center text-xl font-black text-white">MC</div>
            <div>
              <p className="text-white font-bold text-lg">Maya Chen</p>
              <p className="text-slate-400 text-sm">{interviewerRole}</p>
            </div>
            <span className="ml-auto rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">Ready</span>
          </div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-400 font-bold mb-3">{interviewType}</p>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-5">Your interview is ready.</h1>
          <p className="text-slate-400 leading-relaxed mb-8">
            Make yourself comfortable. Maya will introduce the interview, ask follow-up questions, and leave time for your questions at the end.
          </p>
          <div className="grid grid-cols-3 gap-3 mb-10">
            {['Camera check', 'Live conversation', 'Feedback after'].map(item => (
              <div key={item} className="rounded-xl border border-white/8 bg-black/20 p-3 text-center text-[10px] uppercase tracking-wider text-slate-400">{item}</div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={onQuit} className="flex-1 rounded-xl border border-white/10 px-5 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-white hover:border-white/20">Back</button>
            <button onClick={startInterview} className="flex-[2] rounded-xl bg-emerald-500 px-5 py-4 text-[11px] font-black uppercase tracking-widest text-emerald-950 transition hover:bg-emerald-400">Join interview</button>
          </div>
        </div>
      </div>
    );
  }

  const isPanicShaking = mode === 'panic' && timeLeft < 10;
  const themeColor = isAIActive ? 'emerald' : isCustomActive ? 'orange' : isFollowupActive ? 'red' : 'blue';
  const interviewPhase = currentQuestionIdx === 0
    ? 'Opening & background'
    : currentQuestionIdx <= 2
      ? 'Experience & projects'
      : currentQuestionIdx <= 5
        ? 'Technical deep dive'
        : currentQuestionIdx <= 7
          ? 'Behavioral judgment'
          : 'Closing assessment';
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
        {isFollowupActive && (
          <div className="absolute inset-0 bg-red-500/5 transition-opacity duration-1000" />
        )}
      </div>

      <header className="flex items-center justify-between px-6 py-4 md:px-10 relative z-10 border-b border-white/5 bg-[#0a0c10]/70 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button onClick={onQuit} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 transition hover:border-white/20 hover:text-white">Leave</button>
          <div className="hidden sm:block h-7 w-px bg-white/10" />
          <div className="hidden sm:block">
            <p className="text-xs font-bold text-white">Practice interview</p>
            <p className="text-[9px] uppercase tracking-widest text-slate-600">Private session</p>
          </div>
        </div>
        <div className={`flex items-center gap-3 ${isPanicShaking ? 'animate-shake' : ''}`}>
          <div className="hidden md:block"><Logo size="sm" /></div>
          <div className={`text-2xl md:text-3xl font-black tabular-nums tracking-tight ${timeLeft < 10 && mode === 'panic' ? 'text-red-500' : 'text-white'}`}>
            {mode === 'panic'
              ? timeLeft
              : isAIActive
                ? `${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}`
                : `${currentQuestionIdx + 1}/${isConversational ? 5 : 3}`}
          </div>
          <div className="hidden sm:block text-[9px] uppercase font-bold tracking-[0.25em] text-slate-600">
            {mode === 'panic' ? 'Time remaining' : isAIActive ? 'Interview time' : 'Question'}
          </div>
          {isAIActive && (
            <span className="hidden lg:inline rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[9px] uppercase tracking-widest text-emerald-300">{interviewPhase}</span>
          )}
        </div>
        <div className={`hidden md:block rounded-full border px-3 py-1 text-[9px] font-bold uppercase tracking-widest ${isAIActive ? 'border-emerald-500/20 text-emerald-300' : isCustomActive ? 'border-orange-500/20 text-orange-300' : isFollowupActive ? 'border-red-500/20 text-red-300' : 'border-blue-500/20 text-blue-300'}`}>
          {isAIActive ? 'Maya Chen' : isCustomActive ? `${customContext?.role || 'Role interview'}` : 'Live interview'}
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 px-5 py-5 md:px-10 md:py-6 pb-36 overflow-y-auto lg:overflow-hidden relative z-10">
        {/* Main Content Area */}
        <div className={showTranscript
          ? 'lg:col-span-7 flex flex-col justify-center space-y-5'
          : 'hidden'
        }>
          <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-700" key={currentQuestionIdx}>
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center space-x-2">
              <span className={`w-1.5 h-1.5 rounded-full ${isAIActive ? 'bg-emerald-500' : isCustomActive ? 'bg-orange-500' : isFollowupActive ? 'bg-red-500' : 'bg-blue-500'}`} />
              <span className={`${isAIActive ? 'text-emerald-400' : isCustomActive ? 'text-orange-400' : isFollowupActive ? 'text-red-400' : 'text-blue-400'} font-bold uppercase tracking-[0.25em] text-[10px]`}>
                {isAIActive ? 'Maya Chen · Senior interviewer' : isCustomActive ? `${customContext?.role || 'Role interviewer'}` : isFollowupActive ? 'Senior technical interviewer' : 'Technical interviewer'}
              </span>
              </div>
              <span className="text-[10px] font-medium text-slate-600">{isListening ? 'Your turn' : isAISpeaking ? 'Interviewer speaking' : 'Stand by'}</span>
            </div>
            {showTranscript ? (
              <>
                <h2 className={`max-w-4xl text-3xl font-black leading-[1.15] tracking-tight text-white md:text-4xl lg:text-5xl ${isAISpeaking ? 'opacity-90' : ''}`}>
                  {interviewStage === 'candidate-questions'
                    ? 'Before we finish, what questions would you like to ask Maya?'
                    : questions[currentQuestionIdx]?.text || 'Maya is speaking...'}
                </h2>
                <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] ${isAIActive ? 'text-emerald-400' : isCustomActive ? 'text-orange-400' : isFollowupActive ? 'text-red-400' : 'text-blue-400'}`}>
                  {isAIThinking ? (
                    <span className="text-slate-500 normal-case tracking-normal italic">Maya is preparing a follow-up...</span>
                  ) : isPausePending ? (
                    <span className="text-amber-300 normal-case tracking-normal">Take your time. Continue when you’re ready.</span>
                  ) : isAISpeaking ? (
                    <>
                      <span className="flex space-x-1">
                        <span className="h-3 w-1 animate-bounce bg-current" style={{ animationDelay: '0ms' }} />
                        <span className="h-3 w-1 animate-bounce bg-current" style={{ animationDelay: '100ms' }} />
                        <span className="h-3 w-1 animate-bounce bg-current" style={{ animationDelay: '200ms' }} />
                      </span>
                      <span>Maya is speaking</span>
                    </>
                  ) : (
                    <span className="normal-case tracking-normal">Your answer will be captured automatically.</span>
                  )}
                </div>
              </>
            ) : (
              <div className={`flex items-center gap-2 text-[10px] font-semibold ${isAIActive ? 'text-emerald-400' : isCustomActive ? 'text-orange-400' : isFollowupActive ? 'text-red-400' : 'text-blue-400'}`}>
                {isAIThinking ? (
                  <span className="text-slate-500 italic">Maya is preparing a follow-up...</span>
                ) : isPausePending ? (
                  <span className="text-amber-300">Take your time. Continue when you’re ready.</span>
                ) : isAISpeaking ? (
                  <>
                    <span className="flex space-x-1">
                      <span className="h-3 w-1 animate-bounce bg-current" style={{ animationDelay: '0ms' }} />
                      <span className="h-3 w-1 animate-bounce bg-current" style={{ animationDelay: '100ms' }} />
                      <span className="h-3 w-1 animate-bounce bg-current" style={{ animationDelay: '200ms' }} />
                    </span>
                    <span>Maya is speaking</span>
                  </>
                ) : (
                  <span>Your answer will be captured automatically.</span>
                )}
              </div>
            )}
          </div>

          {showTranscript && (
            <div className={`relative w-full bg-black/30 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-3xl transition-all duration-500 ${isListening ? `ring-1 ${isAIActive ? 'ring-emerald-500/30' : isCustomActive ? 'ring-orange-500/30' : 'ring-blue-500/30'}` : 'opacity-70'}`}>
              <div className="p-4 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-slate-700'}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Interview text</span>
                </div>
                <span className="text-[10px] text-slate-600">Only visible to you</span>
              </div>
              <div className="max-h-96 overflow-y-auto p-6 text-sm leading-relaxed">
                <div>
                  <p className="mb-2 text-[9px] font-black uppercase tracking-[0.25em] text-slate-500">Your answer</p>
                  {!transcript && !interimTranscript ? (
                    <span className="text-slate-600 italic">{isListening ? 'Listening for your answer...' : 'Your transcript will appear here.'}</span>
                  ) : (
                    <>
                      <span className="text-slate-300">{transcript}</span>
                      <span className={`${isAIActive ? 'text-emerald-400' : isCustomActive ? 'text-orange-400' : 'text-blue-400'} font-semibold`}> {interimTranscript}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Interviewer presence */}
        <div className={showTranscript
          ? 'lg:col-span-5 flex flex-col justify-center gap-3 animate-in fade-in slide-in-from-right-4 duration-700'
          : 'lg:col-span-12 grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:px-12 lg:px-20 animate-in fade-in duration-700'
        }>
          {!showTranscript && (
            <div className="w-full max-w-2xl justify-self-end bg-white/[0.04] border border-white/10 p-4 rounded-3xl backdrop-blur-2xl shadow-2xl">
              <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950">
                <div className={`w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center text-2xl font-black text-white ${isAISpeaking ? 'ring-4 ring-emerald-400/40 animate-pulse' : ''}`}>MC</div>
                <span className="absolute bottom-3 left-3 rounded-full bg-black/50 px-2 py-1 text-[9px] uppercase tracking-widest text-slate-300">{isAISpeaking ? 'Speaking' : isListening ? 'Listening' : 'Waiting'}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-bold text-white">Maya Chen</p>
                <span className="hidden text-[8px] uppercase tracking-widest text-slate-600 xl:inline">Interviewer</span>
              </div>
            </div>
          )}
          <div className={showTranscript ? '' : 'w-full max-w-2xl justify-self-start'}>
            <CameraFeed compact accentColor={isFollowupActive ? 'red' : isAIActive ? 'emerald' : isCustomActive ? 'orange' : 'blue'} />
          </div>
        </div>
      </main>

      {/* Control Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-[#0a0c10]/90 px-5 py-4 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3 md:gap-4">
          <button
            onClick={() => setShowTranscript(value => !value)}
            aria-pressed={showTranscript}
            className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest shadow-lg transition-all ${showTranscript
              ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200 shadow-emerald-500/10'
              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:border-emerald-300/70 hover:bg-emerald-500/20 hover:text-white'
            }`}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16M4 12h16M4 19h10" />
            </svg>
            {showTranscript ? 'Hide transcript' : 'Show transcript'}
          </button>
          <button
            onClick={toggleMic}
            disabled={isAISpeaking || isAIThinking}
            className={`p-5 md:p-6 rounded-full transition-all duration-500 transform relative ${(isAISpeaking || isAIThinking)
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
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isListening ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 18.5a6 6 0 006-6v-5a6 6 0 00-12 0v5a6 6 0 006 6z M19 12.5a7 7 0 01-14 0" />
              )}
            </svg>
          </button>

          {interviewStage === 'candidate-questions' && (
            <button
              onClick={finishCandidateQuestions}
              className="group px-6 py-3.5 bg-white text-black hover:bg-emerald-500 hover:text-white font-black rounded-xl transition-all uppercase tracking-[0.2em] text-[10px] shadow-xl"
            >
              Finish interview
            </button>
          )}

          {isAIActive && (
            <button
              onClick={endSessionEarly}
              className="group px-10 py-4 border border-emerald-500/40 text-emerald-400 font-black rounded-2xl transition-all hover:bg-emerald-500 hover:text-white uppercase tracking-[0.3em] text-[10px] shadow-xl"
            >
              End Interview
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

        <div className="mt-3 flex w-full flex-col items-center gap-2">
          <p className="text-center text-[9px] font-medium text-slate-600 uppercase tracking-[0.25em]">
            {interviewStage === 'interview' ? 'Answer submits automatically after a short pause' : 'Private practice session · Feedback appears after you finish'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Simulation;
