
import React from 'react';
import { SimulationMode } from '../types';

interface ModeSelectProps {
  onSelect: (mode: SimulationMode) => void;
  onHome: () => void;
}

const ModeSelect: React.FC<ModeSelectProps> = ({ onSelect, onHome }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-full py-16 px-6">
      <div className="mb-4">
        <h1 className="text-xl font-black tracking-tighter text-white opacity-50 italic">CLUTCH<span className="text-blue-500">AI</span></h1>
      </div>
      <h2 className="mb-12 text-xs font-black tracking-[0.4em] text-slate-500 uppercase">Select Training Protocol</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full">
        <button
          onClick={() => onSelect('viva')}
          className="glass-card group flex flex-col items-start p-8 text-left rounded-2xl transition-all duration-300 hover:border-blue-500/50 hover:translate-y-[-2px] hover:shadow-[0_0_50px_rgba(59,130,246,0.18)] relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 text-6xl opacity-10 group-hover:opacity-20 transition-opacity font-serif italic">V</div>
          <span className="mb-4 inline-flex items-center px-3 py-1 text-xs font-bold tracking-widest text-blue-400 uppercase bg-blue-400/10 rounded-full">Recommended</span>
          <h3 className="text-3xl font-bold mb-3 text-white">Viva Mode</h3>
          <p className="text-slate-400 text-lg leading-relaxed">
            Standard interview-style protocol. Focuses on clarity and controlled logic. 3 questions.
          </p>
          <div className="mt-8 text-sm font-semibold text-blue-500 group-hover:translate-x-1 transition-transform inline-flex items-center">
            Start Session <span className="ml-2">→</span>
          </div>
        </button>

        <button
          onClick={() => onSelect('panic')}
          className="glass-card group flex flex-col items-start p-8 text-left rounded-2xl transition-all duration-300 hover:border-red-500/50 hover:translate-y-[-2px] hover:shadow-[0_0_50px_rgba(239,68,68,0.18)] relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 text-6xl opacity-10 group-hover:opacity-20 transition-opacity font-serif italic">P</div>
          <span className="mb-4 inline-flex items-center px-3 py-1 text-xs font-bold tracking-widest text-red-400 uppercase bg-red-400/10 rounded-full">Stress Test</span>
          <h3 className="text-3xl font-bold mb-3 text-white">Panic Mode</h3>
          <p className="text-slate-400 text-lg leading-relaxed">
            High-velocity assault. Automatic cycling. Measures recovery and rapid-fire accuracy.
          </p>
          <div className="mt-8 text-sm font-semibold text-red-500 group-hover:translate-x-1 transition-transform inline-flex items-center">
            Initiate Burn <span className="ml-2">→</span>
          </div>
        </button>
      </div>
      
      <button 
        onClick={onHome}
        className="mt-12 text-slate-500 hover:text-white transition-colors uppercase tracking-[0.3em] text-[10px] font-black px-6 py-3 border border-slate-800 rounded-full"
      >
        Exit to Home
      </button>
    </div>
  );
};

export default ModeSelect;
