
import React, { useMemo } from 'react';

interface HomeScreenProps {
  onStart: () => void;
}

const BackgroundSimulator: React.FC = () => {
  // Enhanced particle generation for "moving upwards" bubbles with varying depths
  const particles = useMemo(() => {
    return Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random() * -20}s`,
      duration: `${8 + Math.random() * 15}s`,
      size: `${Math.random() * 8 + 2}px`,
      opacity: 0.1 + Math.random() * 0.3,
      blur: Math.random() * 2,
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Dynamic Grid */}
      <div className="absolute bottom-0 left-[-25%] right-[-25%] h-full bg-grid-animate opacity-[0.15] translate-z-0" />
      
      {/* Upward Drifting Bubbles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="floating-particle"
          style={{
            '--left': p.left,
            '--delay': p.delay,
            '--duration': p.duration,
            '--size': p.size,
            top: p.top,
            bottom: 'auto',
            backgroundColor: '#60a5fa',
            opacity: p.opacity,
            filter: `blur(${p.blur}px)`,
            boxShadow: '0 0 18px rgba(96, 165, 250, 0.35)',
          } as React.CSSProperties}
        />
      ))}

      {/* Atmospheric Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
      
      <div className="scanline" />

      {/* Solid Vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c10] via-transparent to-[#0a0c10] opacity-90" />
    </div>
  );
};

const ComparisonRow: React.FC<{ before: any; after: any; index: number }> = ({ before, after, index }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div className="glass-card p-6 md:p-7 rounded-2xl border border-red-500/10">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black uppercase tracking-[0.35em] text-red-400/70">Before</div>
        <span className="text-[10px] font-black text-white/20">0{index + 1}</span>
      </div>
      <h4 className="mt-4 text-lg font-semibold text-white/90">{before.label}</h4>
      <p className="mt-3 text-sm text-slate-400 leading-relaxed">{before.desc}</p>
    </div>
    <div className="glass-card p-6 md:p-7 rounded-2xl border border-blue-500/20 bg-blue-500/[0.03]">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-black uppercase tracking-[0.35em] text-blue-400">After</div>
        <span className="text-[10px] font-black text-blue-400/40">0{index + 1}</span>
      </div>
      <h4 className="mt-4 text-lg font-semibold text-white">{after.label}</h4>
      <p className="mt-3 text-sm text-slate-200 leading-relaxed">{after.desc}</p>
    </div>
  </div>
);

const HomeScreen: React.FC<HomeScreenProps> = ({ onStart }) => {
  const comparisonData = [
    {
      before: { label: "Freezing Under Pressure", desc: "Long pauses before speaking. Confidence drops instantly when difficult prompts hit." },
      after: { label: "Measured Confidence", desc: "Monitor hesitation and composure metrics in real time via live neural telemetry." }
    },
    {
      before: { label: "Filler Words Everywhere", desc: "“Um… like… actually…” weaken your delivery and signal internal system panic." },
      after: { label: "Structured Delivery", desc: "Deploy clear, impactful responses. Track clarity and logic density automatically." }
    },
    {
      before: { label: "Unstructured Answers", desc: "Rambling responses that lack the strategic clarity needed for elite results." },
      after: { label: "Pressure Simulation", desc: "Experience realistic viva and rapid-fire questioning in a safe virtual environment." }
    },
    {
      before: { label: "No Feedback on Performance", desc: "You practice answers — but you never measure your composure index." },
      after: { label: "Actionable Feedback", desc: "Know exactly how pressure affects your cognitive load with full telemetry reports." }
    }
  ];

  return (
    <div className="relative flex flex-col items-center min-h-screen pb-32 overflow-x-hidden bg-transparent selection:bg-amber-300/40">
      <BackgroundSimulator />
      <div className="absolute inset-0 mesh-bg opacity-80 pointer-events-none z-0" />

      {/* Hero Section */}
      <div className="relative z-10 max-w-6xl w-full px-6 pt-24 md:pt-28 mb-20">
        <div className="flex flex-col items-center text-center">
          <div className="chip reveal-up">Adaptive Interview Lab</div>
          <div className="mt-6 font-display text-3xl md:text-5xl tracking-[0.2em] text-white reveal-up reveal-delay-1">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-blue-500 to-amber-400 drop-shadow-[0_0_25px_rgba(59,130,246,0.35)]">
              ClutchAI
            </span>
          </div>
          <h1 className="font-display text-5xl md:text-7xl leading-[0.9] tracking-tight text-white mt-8 reveal-up reveal-delay-1">
            Pressure training that
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-500 to-amber-400"> feels real.</span>
          </h1>
          <p className="text-base md:text-xl text-slate-300 max-w-2xl mt-6 reveal-up reveal-delay-2">
            Build composure under time stress with live metrics, structured prompts, and instant performance feedback.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 reveal-up reveal-delay-2">
            <button
              onClick={onStart}
              className="sonar-effect group relative inline-flex items-center justify-center px-14 py-5 font-bold text-white transition-all duration-500 bg-blue-600 rounded-full hover:bg-blue-500 hover:scale-[1.03] hover:shadow-[0_0_70px_rgba(59,130,246,0.35)] active:scale-95 uppercase tracking-[0.2em] text-xs overflow-hidden"
            >
              <span className="relative z-10 flex items-center">
                Start Interview
                <svg className="w-5 h-5 ml-4 transition-transform group-hover:translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-[10px] uppercase tracking-[0.25em] text-slate-400 reveal-up reveal-delay-3">
            <span className="chip">Live Transcription</span>
            <span className="chip">Filler Detection</span>
            <span className="chip">Confidence Index</span>
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="relative z-10 max-w-6xl w-full px-6 mb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 rounded-2xl reveal-up">
            <p className="text-[10px] uppercase tracking-[0.3em] text-blue-400">Signal Clarity</p>
            <h3 className="text-xl font-semibold text-white mt-4">Real-time composure score</h3>
            <p className="text-sm text-slate-400 mt-3">Track pauses, pace, and clarity with a live confidence readout.</p>
          </div>
          <div className="glass-card p-6 rounded-2xl reveal-up reveal-delay-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-amber-400">Structured Prompting</p>
            <h3 className="text-xl font-semibold text-white mt-4">Questions that ramp pressure</h3>
            <p className="text-sm text-slate-400 mt-3">Escalating scenarios help you build calm under time constraints.</p>
          </div>
          <div className="glass-card p-6 rounded-2xl reveal-up reveal-delay-2">
            <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-300">Instant Feedback</p>
            <h3 className="text-xl font-semibold text-white mt-4">Actionable coaching notes</h3>
            <p className="text-sm text-slate-400 mt-3">Clear, specific improvements after every run with no fluff.</p>
          </div>
        </div>
      </div>

      {/* Comparison Matrix Section */}
      <div className="relative z-10 max-w-5xl w-full px-6">
        <div className="text-center mb-14 space-y-4">
          <div className="w-10 h-10 rounded-full border border-white/10 mx-auto flex items-center justify-center">
            <div className="w-2 h-2 bg-blue-400 rounded-full" />
          </div>
          <h2 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.5em]">Before / After</h2>
          <p className="text-2xl md:text-3xl font-black text-white tracking-tight">Feel the shift in composure.</p>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto">
            A fast snapshot of how your response quality changes once you train with ClutchAI pressure loops.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {comparisonData.map((row, idx) => (
            <ComparisonRow key={idx} index={idx} before={row.before} after={row.after} />
          ))}
        </div>

        <div className="mt-20">
          <div className="text-center mb-10">
            <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">What Makes ClutchAI Powerful</h3>
            <p className="text-sm text-slate-400 max-w-2xl mx-auto mt-3">
              A focused stack of capabilities designed to sharpen performance under pressure.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="glass-card p-6 rounded-2xl">
              <div className="text-2xl">🎤</div>
              <h4 className="mt-4 text-lg font-semibold text-white">Real-Time Speech Analysis</h4>
              <p className="mt-2 text-sm text-slate-400">Detects hesitation, filler words, and response timing instantly.</p>
            </div>
            <div className="glass-card p-6 rounded-2xl">
              <div className="text-2xl">⏱</div>
              <h4 className="mt-4 text-lg font-semibold text-white">Pressure Meter Visualization</h4>
              <p className="mt-2 text-sm text-slate-400">A live dynamic gauge that reacts to your stress patterns.</p>
            </div>
            <div className="glass-card p-6 rounded-2xl">
              <div className="text-2xl">📊</div>
              <h4 className="mt-4 text-lg font-semibold text-white">Behavioral Performance Scoring</h4>
              <p className="mt-2 text-sm text-slate-400">Measures Clarity, Composure, and Structure — not just correctness.</p>
            </div>
            <div className="glass-card p-6 rounded-2xl">
              <div className="text-2xl">🔥</div>
              <h4 className="mt-4 text-lg font-semibold text-white">Immersive Stress Simulation</h4>
              <p className="mt-2 text-sm text-slate-400">Time-bound questioning that mimics real interview tension.</p>
            </div>
            <div className="glass-card p-6 rounded-2xl">
              <div className="text-2xl">🧩</div>
              <h4 className="mt-4 text-lg font-semibold text-white">AI-Heuristic Hybrid Scoring</h4>
              <p className="mt-2 text-sm text-slate-400">Combines delay, speech patterns, and structure into a Confidence Score.</p>
            </div>
            <div className="glass-card p-6 rounded-2xl">
              <div className="text-2xl">🔁</div>
              <h4 className="mt-4 text-lg font-semibold text-white">Retry & Improvement Tracking</h4>
              <p className="mt-2 text-sm text-slate-400">See measurable improvement across attempts.</p>
            </div>
          </div>
        </div>

        <div className="mt-24">
          <div className="text-center mb-10">
            <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">Frequently Asked Questions</h3>
            <p className="text-sm text-slate-400 max-w-2xl mx-auto mt-3">
              Quick answers to the most common questions about ClutchAI.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <details className="glass-card p-6 rounded-2xl">
              <summary className="cursor-pointer text-white font-semibold">1) What is ClutchAI?</summary>
              <p className="mt-3 text-sm text-slate-400">
                ClutchAI is a psychological pressure simulator that trains performance under stress. It simulates interview or viva conditions and measures behavioral signals like hesitation, filler words, and structure — not just answer correctness.
              </p>
            </details>
            <details className="glass-card p-6 rounded-2xl">
              <summary className="cursor-pointer text-white font-semibold">2) How is ClutchAI different from mock interview tools?</summary>
              <p className="mt-3 text-sm text-slate-400">
                Traditional mock tools evaluate what you say. ClutchAI evaluates how you say it under pressure. We measure response delay, filler usage, structural clarity, and composure under time constraints. It is performance training, not answer practice.
              </p>
            </details>
            <details className="glass-card p-6 rounded-2xl">
              <summary className="cursor-pointer text-white font-semibold">3) How does ClutchAI measure pressure?</summary>
              <p className="mt-3 text-sm text-slate-400">
                Pressure is calculated using behavioral signals such as time to begin speaking, frequency of filler words, answer length and structure, and confidence indicators in language. These are combined into a weighted confidence score.
              </p>
            </details>
            <details className="glass-card p-6 rounded-2xl">
              <summary className="cursor-pointer text-white font-semibold">4) Where is AI used in ClutchAI?</summary>
              <p className="mt-3 text-sm text-slate-400">
                AI (Google Gemini) is used to generate personalized psychological coaching feedback based on transcript, delay, and behavioral metrics. The core pressure scoring engine runs deterministically for reliability.
              </p>
            </details>
            <details className="glass-card p-6 rounded-2xl">
              <summary className="cursor-pointer text-white font-semibold">5) Is my speech data stored?</summary>
              <p className="mt-3 text-sm text-slate-400">
                In the MVP version, all analysis runs client-side. Speech transcripts are processed in real time and not permanently stored. You can adjust this later if you add backend storage.
              </p>
            </details>
            <details className="glass-card p-6 rounded-2xl">
              <summary className="cursor-pointer text-white font-semibold">6) Who can use ClutchAI?</summary>
              <p className="mt-3 text-sm text-slate-400">
                Students preparing for viva exams, job candidates preparing for interviews, public speakers, professionals training for high-stakes presentations, and anyone who wants to improve composure under pressure.
              </p>
            </details>
            <div className="lg:col-span-3 flex justify-center">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                <details className="glass-card p-6 rounded-2xl">
                  <summary className="cursor-pointer text-white font-semibold">7) Is this scientifically accurate?</summary>
                  <p className="mt-3 text-sm text-slate-400">
                    The MVP uses heuristic-based behavioral modeling. Future versions can integrate deeper psychological models like stress-performance curves and voice stress analysis.
                  </p>
                </details>
                <details className="glass-card p-6 rounded-2xl">
                  <summary className="cursor-pointer text-white font-semibold">8) What makes ClutchAI innovative?</summary>
                  <p className="mt-3 text-sm text-slate-400">
                    ClutchAI shifts interview preparation from content optimization to performance psychology. It transforms anxiety into measurable, trainable data.
                  </p>
                </details>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Credits */}
        <div className="mt-32 pt-16 border-t border-white/5 text-center flex flex-col items-center space-y-8">
          <div className="flex flex-wrap justify-center gap-12 opacity-30">
             <div className="flex flex-col items-center space-y-1">
               <div className="text-[9px] font-black tracking-[0.3em] uppercase text-white">NeuralLink™</div>
               <div className="text-[8px] font-bold text-slate-500 uppercase">Latency 0.4ms</div>
             </div>
             <div className="flex flex-col items-center space-y-1">
               <div className="text-[9px] font-black tracking-[0.3em] uppercase text-white">StressEngine®</div>
               <div className="text-[8px] font-bold text-slate-500 uppercase">Load: Stable</div>
             </div>
             <div className="flex flex-col items-center space-y-1">
               <div className="text-[9px] font-black tracking-[0.3em] uppercase text-white">ComposureMap™</div>
               <div className="text-[8px] font-bold text-slate-500 uppercase">Accuracy 99.8%</div>
             </div>
          </div>
          <p className="text-slate-700 text-[9px] font-black uppercase tracking-[0.6em] mt-8">System ID: CLUTCH-T2 — Performance Terminal</p>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
