
import React from 'react';
import Logo from './Logo';

interface HomeScreenProps {
  onStart: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onStart }) => {
  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: 'transparent' }}>

      {/* - Decorative orbs - */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="orb" style={{ width: 600, height: 600, top: -200, left: -150, background: 'radial-gradient(circle, rgba(59,130,246,0.18), transparent 70%)' }} />
        <div className="orb" style={{ width: 500, height: 500, top: -100, right: -100, background: 'radial-gradient(circle, rgba(139,92,246,0.14), transparent 70%)' }} />
        <div className="orb" style={{ width: 400, height: 400, bottom: '20%', left: '30%', background: 'radial-gradient(circle, rgba(16,185,129,0.10), transparent 70%)' }} />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-10 md:py-14">

        {/* - Header - */}
        <header className="mb-14 flex items-center justify-between">
          <div>
            <Logo size="md" className="items-start" />
            <p className="mt-1.5 text-[10px] uppercase tracking-[0.25em] text-slate-500">Interview Performance Platform</p>
          </div>
          <div className="chip">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Voice + AI Coaching
          </div>
        </header>

        {/* - Hero - */}
        <section className="relative mb-6">
          <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 text-[160px] font-black uppercase tracking-tighter leading-none select-none"
            style={{ opacity: 0.025, color: '#fff', whiteSpace: 'nowrap' }}>
            CLUTCH
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="glass-card glow-border rounded-3xl p-9 md:p-11 relative overflow-hidden">
              <div className="pointer-events-none absolute -right-20 -top-20 w-72 h-72 rounded-full border border-blue-500/10" />
              <div className="pointer-events-none absolute -right-12 -top-12 w-52 h-52 rounded-full border border-blue-500/10" />

              <span className="mb-6 inline-flex items-center rounded-full bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-blue-300">
                <span className="mr-2 w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
                Professional Practice
              </span>

              <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.1]">
                <span className="gradient-text">Train for interviews</span>
                <br />
                <span className="text-white/90">under real pressure.</span>
              </h1>

              <p className="mt-5 text-slate-300/90 text-[15px] leading-7 max-w-lg">
                Simulate high-stakes conditions, monitor response quality in real time, and improve with deep AI coaching after every attempt.
              </p>

              <div className="mt-7 flex flex-wrap gap-2.5">
                {['Live transcription', 'Resume-aware AI', 'Performance scoring', 'Panic simulation'].map(t => (
                  <span key={t} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[11px] text-slate-300 font-medium">{t}</span>
                ))}
              </div>

              <button
                onClick={onStart}
                className="btn-glow mt-9 inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-9 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white shadow-[0_8px_32px_rgba(59,130,246,0.4)] hover:shadow-[0_12px_48px_rgba(59,130,246,0.55)] hover:-translate-y-0.5 transition-all duration-200"
              >
                Start Practice
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>

            <div className="glass-card rounded-3xl border border-white/10 overflow-hidden relative min-h-[400px]">
              <img
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=85"
                alt="Interview preparation"
                className="absolute inset-0 h-full w-full object-cover"
                style={{ filter: 'saturate(0.7) brightness(0.65)' }}
              />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #060810 0%, rgba(6,8,16,0.7) 45%, rgba(6,8,16,0.15) 100%)' }} />
              <div className="absolute top-0 inset-x-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent)' }} />

              <div className="absolute top-6 right-6 glass-card rounded-xl p-3 border border-white/10 text-center min-w-[90px]">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Sessions</p>
                <p className="text-2xl font-black text-white">5K+</p>
              </div>

              <div className="absolute top-6 left-6 glass-card rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Live AI</p>
                </div>
                <p className="text-xs text-white font-semibold">Monitoring</p>
              </div>

              <div className="relative h-full p-8 flex flex-col justify-end">
                <p className="text-[10px] uppercase tracking-[0.25em] text-blue-300 mb-2">Session Highlights</p>
                <h2 className="text-2xl font-bold text-white leading-tight">Clarity, composure, and structure - measured live.</h2>
                <p className="mt-3 text-sm text-slate-300/90 leading-relaxed">Built for job candidates, viva exams, and high-stakes presentations.</p>
              </div>
            </div>
          </div>
        </section>

        {/* - Stat strip - */}
        <section className="my-10">
          <div className="glass-card rounded-2xl border border-white/8 px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-6 divide-x divide-white/5">
            {[
              { num: '5,000+', label: 'Practice sessions' },
              { num: '94%',    label: 'Composure improvement' },
              { num: '4',      label: 'Simulation modes' },
              { num: '<1s',    label: 'AI feedback latency' },
            ].map((s) => (
              <div key={s.num} className="flex flex-col items-center text-center px-4">
                <span className="stat-num">{s.num}</span>
                <span className="mt-1.5 text-[11px] text-slate-400 uppercase tracking-widest">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Feature cards */}
        <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { accent: 'card-accent-blue',   label: 'SPEECH', title: 'Real-time speech diagnostics', desc: 'Track hesitation, fillers, and pacing the moment you speak - feedback is instant and measurable.' },
            { accent: 'card-accent-purple', label: 'AI',     title: 'Role-aware AI prompts',         desc: 'Upload your resume for personalised questions. AI adapts every prompt to your actual background.' },
            { accent: 'card-accent-green',  label: 'REPORT', title: 'Performance report',            desc: 'Clarity, composure, structure, and confidence scored + coaching suggestions after every session.' },
          ].map((f) => (
            <div key={f.title} className={`glass-card rounded-2xl border border-white/8 p-6 ${f.accent}`}>
              <div className="mb-4">
                <span className="inline-block rounded-lg px-2.5 py-1 text-[10px] font-black tracking-widest border border-white/10 bg-white/5 text-white/60">{f.label}</span>
              </div>
              <h3 className="text-[15px] font-bold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </section>

        <div className="section-divider my-20" />

        {/* - Before / After - */}
        <section>
          <div className="text-center mb-12">
            <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-blue-400 mb-3">Transformation</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight gradient-text">Feel the shift in composure.</h2>
            <p className="mt-4 text-slate-400 max-w-2xl mx-auto text-sm leading-relaxed">
              How response quality changes after training with ClutchAI pressure loops.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {[
              {
                before: { label: 'Freezing Under Pressure', desc: 'Long pauses before speaking. Confidence drops when difficult prompts hit.' },
                after:  { label: 'Measured Confidence',     desc: 'Monitor hesitation and composure metrics in real time with live data.' },
              },
              {
                before: { label: 'Filler Words Everywhere',  desc: '"Um... like... actually..." weaken your delivery and signal internal panic.' },
                after:  { label: 'Structured Delivery',      desc: 'Track clarity and logic density automatically. Clear responses get rewarded.' },
              },
              {
                before: { label: 'Unstructured Answers',    desc: 'Rambling responses that lack the clarity needed for high-stakes situations.' },
                after:  { label: 'Pressure Simulation',     desc: 'Realistic viva and rapid-fire questioning in a controlled practice environment.' },
              },
              {
                before: { label: 'Zero Performance Data',   desc: 'You practice answers - but never measure composure under stress.' },
                after:  { label: 'Actionable Feedback',     desc: 'Full post-session reports show exactly how pressure shapes your delivery.' },
              },
            ].map((row, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card card-accent-rose rounded-2xl border border-rose-500/10 bg-rose-500/[0.02] p-6">
                  <span className="inline-block rounded-full bg-rose-500/10 border border-rose-500/20 px-3 py-0.5 text-[9px] font-black uppercase tracking-[0.3em] text-rose-400 mb-4">Before</span>
                  <h4 className="text-[15px] font-bold text-white/90 mb-2">{row.before.label}</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">{row.before.desc}</p>
                </div>
                <div className="glass-card card-accent-blue rounded-2xl border border-blue-500/15 bg-blue-500/[0.03] p-6">
                  <span className="inline-block rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-0.5 text-[9px] font-black uppercase tracking-[0.3em] text-blue-400 mb-4">After</span>
                  <h4 className="text-[15px] font-bold text-white mb-2">{row.after.label}</h4>
                  <p className="text-sm text-slate-300 leading-relaxed">{row.after.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="section-divider my-20" />

        {/* - Powers - */}
        <section>
          <div className="text-center mb-12">
            <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-purple-400 mb-3">Capabilities</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">What makes ClutchAI powerful</h2>
            <p className="mt-4 text-slate-400 max-w-2xl mx-auto text-sm leading-relaxed">
              A focused set of capabilities designed to sharpen performance under pressure.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'MIC',    accent: 'card-accent-blue',   grad: 'from-blue-500/20',    title: 'Real-Time Speech Analysis',        desc: 'Detects hesitation, filler words, and response timing the moment you speak.' },
              { label: 'TIMER',  accent: 'card-accent-rose',   grad: 'from-rose-500/20',    title: 'Pressure Meter Visualisation',     desc: 'A live dynamic gauge that reacts to your stress patterns throughout the session.' },
              { label: 'CHART',  accent: 'card-accent-green',  grad: 'from-emerald-500/20', title: 'Behavioural Performance Scoring',  desc: 'Measures Clarity, Composure, and Structure - not just answer correctness.' },
              { label: 'FIRE',   accent: 'card-accent-amber',  grad: 'from-amber-500/20',   title: 'Immersive Stress Simulation',      desc: 'Time-bound questioning that mimics the tension of real high-stakes interviews.' },
              { label: 'AI',     accent: 'card-accent-purple', grad: 'from-purple-500/20',  title: 'AI-Heuristic Hybrid Engine',       desc: 'Combines delay, speech patterns, and structure into a single Confidence Score.' },
              { label: 'RETRY',  accent: 'card-accent-cyan',   grad: 'from-cyan-500/20',    title: 'Retry & Progress Tracking',        desc: 'See measurable improvement across multiple attempts with session history.' },
            ].map((item) => (
              <div key={item.title} className={`glass-card ${item.accent} rounded-2xl border border-white/8 p-6 relative overflow-hidden`}>
                <div className={`pointer-events-none absolute top-0 right-0 w-32 h-32 rounded-full bg-gradient-to-bl ${item.grad} to-transparent blur-2xl opacity-60`} />
                <div className="mb-4 relative z-10">
                  <span className="inline-block rounded-lg px-2.5 py-1 text-[10px] font-black tracking-widest border border-white/10 bg-white/5 text-white/60">{item.label}</span>
                </div>
                <h4 className="text-[15px] font-bold text-white mb-2 relative z-10">{item.title}</h4>
                <p className="text-sm text-slate-400 leading-relaxed relative z-10">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="section-divider my-20" />

        {/* - FAQ - */}
        <section className="pb-24">
          <div className="text-center mb-12">
            <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-emerald-400 mb-3">FAQ</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">Frequently asked questions</h2>
            <p className="mt-4 text-slate-400 max-w-2xl mx-auto text-sm leading-relaxed">Quick answers about ClutchAI.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {([
              { q: 'What is ClutchAI?',
                a: 'A psychological pressure simulator that trains performance under stress. It simulates interview / viva conditions and measures behavioural signals like hesitation, filler words, and structure.' },
              { q: 'How is it different from mock interview tools?',
                a: 'Traditional tools evaluate what you say. ClutchAI evaluates how you say it under pressure - measuring delay, filler usage, structural clarity, and composure under time constraints.' },
              { q: 'How does ClutchAI measure pressure?',
                a: 'Pressure is calculated from behavioural signals: time to begin speaking, filler frequency, answer length and structure, and confidence indicators - combined into a weighted score.' },
              { q: 'Where is AI used?',
                a: 'AI generates personalised coaching feedback based on your transcript, delay, and behavioural metrics. The core pressure scoring runs deterministically for consistency.' },
              { q: 'Is my speech data stored?',
                a: 'All analysis runs client-side. Transcripts are not permanently stored or sent to any server beyond the AI feedback call.' },
              { q: 'Who is ClutchAI for?',
                a: 'Students preparing for viva exams, job candidates, public speakers, and professionals training for high-stakes presentations.' },
              { q: 'Is this scientifically accurate?',
                a: 'The system uses heuristic-based behavioural modelling. Future versions can integrate deeper psychological models like stress-performance curves and voice stress analysis.' },
              { q: 'What makes ClutchAI innovative?',
                a: 'It shifts interview preparation from content optimisation to performance psychology - transforming anxiety into measurable, trainable data.' },
            ] as { q: string; a: string }[]).map((faq, i) => (
              <details key={faq.q} className="glass-card rounded-2xl border border-white/8 p-6 group cursor-pointer">
                <summary className="text-white font-semibold text-[14px] list-none flex items-start justify-between gap-3">
                  <span className="flex items-start gap-3">
                    <span className="shrink-0 text-[10px] font-black text-blue-500/60 mt-0.5 leading-none">{String(i + 1).padStart(2, '0')}</span>
                    {faq.q}
                  </span>
                  <span className="text-slate-500 group-open:rotate-45 transition-transform duration-200 text-lg leading-none mt-0.5 shrink-0">+</span>
                </summary>
                <p className="mt-4 text-sm text-slate-400 leading-relaxed pl-7">{faq.a}</p>
              </details>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="mt-16 glass-card rounded-3xl border border-white/8 p-10 md:p-14 text-center relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 700px 400px at 50% 50%, rgba(59,130,246,0.10), transparent 70%)' }} />
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-blue-400 mb-4 relative z-10">Ready?</p>
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-4 relative z-10">Start your first session now.</h3>
            <p className="text-slate-400 text-sm max-w-lg mx-auto mb-8 leading-relaxed relative z-10">
              No signup required. Pick a mode, answer questions, and get AI coaching - in under 5 minutes.
            </p>
            <button
              onClick={onStart}
              className="btn-glow relative z-10 inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-10 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white shadow-[0_8px_40px_rgba(59,130,246,0.35)] hover:shadow-[0_12px_56px_rgba(59,130,246,0.50)] hover:-translate-y-0.5 transition-all duration-200"
            >
              Begin Practice
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </section>

      </div>
    </div>
  );
};

export default HomeScreen;

