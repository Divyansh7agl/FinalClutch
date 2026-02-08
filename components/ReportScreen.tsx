import React, { useEffect, useRef, useState } from 'react';
import { PerformanceMetrics } from '../types';
import { generateAIFeedback, generateAIChat, setUseFreeMode, setUseOllamaMode } from '../src/utils/aiFeedback';

interface ReportScreenProps {
  metrics: PerformanceMetrics;
  previousMetrics: PerformanceMetrics | null;
  onRetry: () => void;
  onBack: () => void;
  onHome: () => void;
}

const MetricCard: React.FC<{ title: string; score: number; desc: string; color: string }> = ({ title, score, desc, color }) => (
  <div className="bg-white/[0.02] border border-white/5 p-8 rounded-3xl backdrop-blur-xl group hover:border-white/10 transition-colors">
    <div className="flex items-center justify-between mb-4">
      <h4 className="font-black text-slate-500 uppercase tracking-[0.3em] text-[10px]">{title}</h4>
      <span className={`text-3xl font-black tracking-tighter ${color}`}>{score}%</span>
    </div>
    <div className="w-full bg-white/5 h-1.5 rounded-full mb-6 overflow-hidden">
      <div
        className={`h-full ${color.replace('text-', 'bg-')} transition-all duration-1000 ease-out`}
        style={{ width: `${score}%` }}
      />
    </div>
    <p className="text-[11px] text-slate-500 leading-relaxed font-bold uppercase tracking-tight opacity-70 group-hover:opacity-100 transition-opacity">{desc}</p>
  </div>
);

const ReportScreen: React.FC<ReportScreenProps> = ({ metrics, previousMetrics, onRetry, onBack, onHome }) => {
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<'free' | 'ollama' | 'gemini' | 'groq'>('groq');
  const requestIdRef = useRef(0);
  const [aiMetrics, setAiMetrics] = useState<PerformanceMetrics | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Chat State
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Loading Animation State
  const [typingText, setTypingText] = useState('');
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const quotes = [
    'Breathe. Clarity beats speed.',
    'Pressure is a teacher, not a verdict.',
    'Pause. Then deliver with intent.',
    'Own the silence. Then own the answer.',
    'Focus on structure, not noise.'
  ];

  useEffect(() => {
    if (!isGenerating || aiFeedback) {
      setTypingText('');
      return;
    }
    const currentQuote = quotes[quoteIndex % quotes.length];
    const tick = () => {
      setTypingText(prev => {
        if (!isDeleting) {
          const next = currentQuote.slice(0, prev.length + 1);
          if (next.length === currentQuote.length) setIsDeleting(true);
          return next;
        }
        const next = currentQuote.slice(0, Math.max(0, prev.length - 1));
        if (next.length === 0) {
          setIsDeleting(false);
          setQuoteIndex(idx => idx + 1);
        }
        return next;
      });
    };
    const interval = setInterval(tick, isDeleting ? 30 : 50);
    return () => clearInterval(interval);
  }, [isGenerating, isDeleting, quoteIndex, aiFeedback]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatting]);

  const handleSendChat = async () => {
    if (!userInput.trim() || isChatting) return;

    const userMsg = userInput.trim();
    setUserInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsChatting(true);

    try {
      let streamingText = "";
      await generateAIChat(
        [...chatMessages, { role: 'user', content: userMsg }],
        {
          transcript: metrics.transcript,
          delay: metrics.avgDelay,
          fillerCount: metrics.fillerCount,
          confidenceScore: metrics.confidence
        },
        (token) => {
          setChatMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant') {
              return [...prev.slice(0, -1), { role: 'assistant', content: token }];
            }
            return [...prev, { role: 'assistant', content: token }];
          });
        },
        aiMode
      );
    } catch (e) {
      console.error("Chat failed", e);
    } finally {
      setIsChatting(false);
    }
  };

  useEffect(() => {
    // Initial analysis
    (async () => {
      setAiFeedback(null); // Clear previous feedback immediately
      setAiMetrics(null);   // Reset scores to raw simulation metrics
      setIsGenerating(true);
      setUseOllamaMode(aiMode === 'ollama');
      setUseFreeMode(aiMode === 'free');

      const requestId = Date.now();
      requestIdRef.current = requestId;

      try {
        const text = await generateAIFeedback(
          metrics.transcript,
          metrics.avgDelay,
          metrics.fillerCount,
          metrics.confidence,
          (tokenText) => {
            if (requestIdRef.current === requestId) {
              setAiFeedback(tokenText);
            }
          },
          aiMode,
          metrics.responses
        );

        if (requestIdRef.current === requestId) {
          const scoreMatch = text.match(/SCORES:\s*({.+})/i);
          if (scoreMatch) {
            try {
              const scored = JSON.parse(scoreMatch[1]);
              setAiMetrics({
                ...metrics,
                clarity: scored.clarity,
                composure: scored.composure,
                structure: scored.structure,
                confidence: scored.confidence
              });
            } catch (e) { }
          }
          setAiFeedback(text.split(/SCORES:/i)[0].trim());
        }
      } catch (error) {
        console.error('Failed to get AI feedback:', error);
      } finally {
        setIsGenerating(false);
      }
    })();
  }, [aiMode, metrics]);

  const displayMetrics = aiMetrics || metrics;
  const improvement = previousMetrics ? displayMetrics.confidence - previousMetrics.confidence : 0;

  return (
    <div className="relative flex flex-col items-center min-h-screen bg-[#0a0c10] overflow-y-auto px-6 py-20 selection:bg-blue-500/30">
      <div className="max-w-5xl w-full space-y-12 relative z-10">

        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="text-xl font-black tracking-tighter text-white opacity-40 italic">CLUTCH<span className="text-blue-500">AI</span></div>
          <div className="relative">
            <div className="absolute -inset-10 bg-blue-600/10 blur-3xl rounded-full" />
            <h2 className="text-[7rem] md:text-[8rem] font-black text-white tracking-tighter leading-none relative">
              {displayMetrics.confidence}<span className="text-blue-600">%</span>
            </h2>
            <p className="text-sm font-black uppercase tracking-[0.5em] text-slate-600">Composure Index</p>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard title="Clarity" score={displayMetrics.clarity} color="text-emerald-400" desc="Articulation purity." />
          <MetricCard title="Stability" score={displayMetrics.composure} color="text-blue-500" desc="Temporal mastery." />
          <MetricCard title="Logic" score={displayMetrics.structure} color="text-cyan-400" desc="Conceptual depth." />
        </div>

        {/* AI Assessment */}
        <div className="bg-white/[0.02] border border-white/10 p-10 rounded-[2.5rem] relative overflow-hidden group">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-blue-500 font-black uppercase tracking-[0.4em] text-[10px]">Executive Assessment</h3>
          </div>
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500/60">Data Source:</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {aiMetrics ? 'GROQ SPEED ENGINE ANALYSIS' : 'Initializing Neural Link...'}
            </span>
          </div>
          <div className="space-y-4">
            <p className="text-xl md:text-2xl text-slate-200 leading-relaxed font-light italic whitespace-pre-wrap">
              {aiFeedback ? `"${aiFeedback}"` : <span className="opacity-40 tracking-wider font-mono text-sm">System analyzing...</span>}
            </p>
            {isGenerating && !aiFeedback && (
              <div className="text-sm text-slate-400 font-mono tracking-wide animate-in fade-in duration-500">
                {typingText}<span className="inline-block w-2 h-4 bg-blue-500/60 align-middle ml-1 animate-pulse" />
              </div>
            )}
            {isGenerating && aiFeedback && <div className="mt-4 w-12 h-0.5 bg-blue-500 animate-pulse" />}
          </div>
        </div>

        {/* Interactive Chat */}
        <div className="bg-white/[0.01] border border-white/5 rounded-[2.5rem] overflow-hidden flex flex-col h-[500px]">
          <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Tactical Discussion Link</span>
            </div>
            <span className="text-[9px] font-mono text-slate-600 uppercase">Context: Session-Alpha-7</span>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
            {chatMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                <svg className="w-12 h-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p className="text-[10px] font-black uppercase tracking-[.2em] max-w-[200px]">
                  Discussion portal ready. Analyze specific gaps or request drill-down metrics.
                </p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-5 rounded-2xl text-sm ${msg.role === 'user'
                  ? 'bg-blue-600 text-white font-bold ml-12 rounded-tr-none'
                  : 'bg-white/5 text-slate-300 font-medium mr-12 rounded-tl-none border border-white/5'
                  }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isChatting && chatMessages[chatMessages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="bg-white/5 p-4 rounded-2xl animate-pulse">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-slate-600 rounded-full" />
                    <div className="w-1.5 h-1.5 bg-slate-600 rounded-full" />
                    <div className="w-1.5 h-1.5 bg-slate-600 rounded-full" />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-6 border-t border-white/5 bg-black/40">
            <form
              onSubmit={e => { e.preventDefault(); handleSendChat(); }}
              className="relative flex items-center"
            >
              <input
                type="text"
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                placeholder="PROMPT AI INTERVIEW COACH..."
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-6 py-4 text-[11px] font-black uppercase tracking-widest text-white placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
              />
              <button
                type="submit"
                disabled={!userInput.trim() || isChatting}
                className="absolute right-3 p-2 text-blue-500 hover:text-white disabled:opacity-30 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-8">
          <button onClick={onRetry} className="w-full md:w-auto px-10 py-4 bg-white text-black font-black rounded-xl hover:bg-blue-600 hover:text-white transition-all uppercase tracking-[0.2em] text-[10px]">Restart Protocol</button>
          <button onClick={onHome} className="w-full md:w-auto px-10 py-4 text-slate-500 hover:text-white transition-colors font-black uppercase tracking-[0.2em] text-[10px]">Exit Terminal</button>
        </div>
      </div>
    </div>
  );
};

export default ReportScreen;
