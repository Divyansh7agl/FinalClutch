
import React from 'react';
import { SimulationMode } from '../types';
import Logo from './Logo';

interface ModeSelectProps {
  onSelect: (mode: SimulationMode) => void;
  onHome: () => void;
}

const ModeSelect: React.FC<ModeSelectProps> = ({ onSelect, onHome }) => {
  const modeCards = [
    {
      key: 'followup',
      num: '01',
      tag: 'Adversarial',
      title: 'Follow-up Trap',
      description: 'Every answer you give triggers a targeted challenge. The AI exposes gaps, demands proof, and attacks weak points — 5 brutal rounds.',
      cta: 'Enter the Trap',
      tagColor: 'bg-red-500/15 text-red-300 border-red-500/25',
      glow: 'rgba(239,68,68,0.30)',
      borderHover: 'hover:border-red-400/60',
      ctaColor: 'text-red-300',
      accentLine: 'bg-red-500',
      overlay: 'linear-gradient(135deg, rgba(6,8,16,0.88) 30%, rgba(60,10,10,0.70) 100%)',
      image: 'https://images.unsplash.com/photo-1589578228447-e1a4e481c6c8?auto=format&fit=crop&w=1200&q=85',
    },
    {
      key: 'panic',
      num: '02',
      tag: 'High Intensity',
      title: 'Panic Mode',
      description: 'Rapid-fire questioning under visible stress pressure - builds composure and speed recovery.',
      cta: 'Start Stress Drill',
      tagColor: 'bg-rose-500/15 text-rose-300 border-rose-500/25',
      glow: 'rgba(244,63,94,0.30)',
      borderHover: 'hover:border-rose-400/60',
      ctaColor: 'text-rose-300',
      accentLine: 'bg-rose-500',
      overlay: 'linear-gradient(135deg, rgba(6,8,16,0.88) 30%, rgba(50,5,20,0.72) 100%)',
      image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=85',
    },
    {
      key: 'ai-interview',
      num: '03',
      tag: 'Adaptive AI',
      title: 'AI Interview',
      description: 'Conversational AI asks follow-ups based on your answers - upload a resume for targeted questions.',
      cta: 'Start AI Interview',
      tagColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
      glow: 'rgba(16,185,129,0.30)',
      borderHover: 'hover:border-emerald-400/60',
      ctaColor: 'text-emerald-300',
      accentLine: 'bg-emerald-500',
      overlay: 'linear-gradient(135deg, rgba(6,8,16,0.88) 30%, rgba(5,30,20,0.72) 100%)',
      image: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?auto=format&fit=crop&w=1200&q=85',
    },
    {
      key: 'custom',
      num: '04',
      tag: 'Role Based',
      title: 'Custom Mode',
      description: 'Set your target role, topic, and difficulty level for fully tailored interview scenarios.',
      cta: 'Configure Session',
      tagColor: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
      glow: 'rgba(245,158,11,0.30)',
      borderHover: 'hover:border-amber-400/60',
      ctaColor: 'text-amber-300',
      accentLine: 'bg-amber-500',
      overlay: 'linear-gradient(135deg, rgba(6,8,16,0.88) 30%, rgba(35,25,5,0.72) 100%)',
      image: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=85',
    },
  ] as const;

  return (
    <div className="relative flex flex-col items-center justify-start min-h-full py-12 px-6 overflow-hidden">

      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="orb" style={{ width: 500, height: 500, top: -150, left: -100, background: 'radial-gradient(circle, rgba(59,130,246,0.14), transparent 65%)' }} />
        <div className="orb" style={{ width: 400, height: 400, bottom: -100, right: -80, background: 'radial-gradient(circle, rgba(139,92,246,0.12), transparent 65%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-5xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <Logo size="md" />
          <p className="mt-2 text-[10px] uppercase tracking-[0.25em] text-slate-500">Choose your practice mode</p>
          <div className="mt-5 section-divider" />
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {modeCards.map((mode) => (
            <button
              key={mode.key}
              onClick={() => onSelect(mode.key as SimulationMode)}
              className={`glass-card group relative overflow-hidden rounded-3xl border border-white/8 text-left transition-all duration-300 hover:-translate-y-1.5 ${mode.borderHover}`}
              style={{ '--glow-color': mode.glow } as React.CSSProperties}
            >
              {/* Photo */}
              <img
                src={mode.image}
                alt={mode.title}
                className="absolute inset-0 h-full w-full object-cover opacity-35 group-hover:opacity-50 transition-opacity duration-500"
                style={{ filter: 'saturate(0.65) contrast(1.05)' }}
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0" style={{ background: mode.overlay }} />
              {/* Top accent line */}
              <div className={`absolute top-0 left-0 right-0 h-0.5 ${mode.accentLine} opacity-60`} />
              {/* Glow on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ background: `radial-gradient(ellipse 300px 200px at 20% 50%, ${mode.glow}, transparent 70%)` }} />

              <div className="relative z-10 p-8">
                {/* Number + tag row */}
                <div className="flex items-center justify-between mb-5">
                  <span className="text-[11px] font-black text-slate-600 tracking-widest">{mode.num}</span>
                  <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] ${mode.tagColor}`}>
                    {mode.tag}
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">{mode.title}</h3>
                <p className="text-sm leading-relaxed text-slate-300/90 mb-8">{mode.description}</p>

                {/* CTA row */}
                <div className={`flex items-center gap-2 text-sm font-bold ${mode.ctaColor}`}>
                  {mode.cta}
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Back button */}
        <div className="mt-10 flex justify-center">
          <button
            onClick={onHome}
            className="rounded-full border border-white/10 bg-white/[0.03] px-7 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 transition-all hover:text-white hover:border-white/20 hover:bg-white/[0.06]"
          >
            &larr; Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModeSelect;
