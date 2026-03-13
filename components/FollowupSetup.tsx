import React, { useState } from 'react';
import { DifficultyLevel } from '../types';
import Logo from './Logo';

interface FollowupSetupProps {
    onConfirm: (difficulty: DifficultyLevel) => void;
    onBack: () => void;
}

const FollowupSetup: React.FC<FollowupSetupProps> = ({ onConfirm, onBack }) => {
    const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');

    return (
        <div className="flex flex-col items-center justify-center min-h-full py-16 px-6 bg-[#0a0c10]">
            <div className="mb-8 text-center">
                <Logo size="md" />
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Follow-up Trap Setup</p>
            </div>

            <div className="max-w-2xl w-full glass-card p-12 rounded-[2.5rem] border border-red-500/20 shadow-[0_20px_50px_rgba(239,68,68,0.10)] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 text-8xl opacity-5 font-serif italic text-red-500">!</div>
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500 opacity-60" />

                <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 mb-4">
                        <span className="inline-block rounded-full border border-red-500/30 bg-red-500/10 px-3 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-red-300">Adversarial Mode</span>
                    </div>
                    <h2 className="text-3xl font-bold mb-2 text-white">Follow-up Trap Mode</h2>
                    <p className="text-slate-400 mb-8 text-sm font-medium tracking-wide leading-relaxed">
                        The AI acts as a hostile interrogator. Every answer you give spawns a sharp follow-up
                        designed to expose gaps, demand proof, and challenge your assumptions. 5 rounds. No warmth.
                    </p>

                    <div className="space-y-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.4em] text-red-400 ml-1">Interrogation Intensity</label>
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setDifficulty('easy')}
                                    className={`px-6 py-4 rounded-2xl font-bold uppercase tracking-wider text-xs transition-all ${difficulty === 'easy'
                                        ? 'bg-green-500 text-black shadow-[0_0_30px_rgba(34,197,94,0.4)] scale-105'
                                        : 'bg-black/40 border border-white/5 text-slate-500 hover:text-white hover:border-green-500/30'
                                    }`}
                                >
                                    Probing
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDifficulty('medium')}
                                    className={`px-6 py-4 rounded-2xl font-bold uppercase tracking-wider text-xs transition-all ${difficulty === 'medium'
                                        ? 'bg-orange-500 text-black shadow-[0_0_30px_rgba(249,115,22,0.4)] scale-105'
                                        : 'bg-black/40 border border-white/5 text-slate-500 hover:text-white hover:border-orange-500/30'
                                    }`}
                                >
                                    Sharp
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDifficulty('hard')}
                                    className={`px-6 py-4 rounded-2xl font-bold uppercase tracking-wider text-xs transition-all ${difficulty === 'hard'
                                        ? 'bg-red-500 text-black shadow-[0_0_30px_rgba(239,68,68,0.4)] scale-105'
                                        : 'bg-black/40 border border-white/5 text-slate-500 hover:text-white hover:border-red-500/30'
                                    }`}
                                >
                                    Ruthless
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-600 ml-1 mt-1">
                                {difficulty === 'easy' && 'Gentle probing — exposes weak points without being brutal.'}
                                {difficulty === 'medium' && 'Sharp follow-ups — targets gaps and vague claims directly.'}
                                {difficulty === 'hard' && 'Ruthless interrogation — every answer will be challenged hard.'}
                            </p>
                        </div>

                        <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-5 space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-red-400">How it works</p>
                            <ul className="space-y-1.5 text-[11px] text-slate-400 leading-relaxed">
                                <li>The AI opens with one challenging question</li>
                                <li>Your answer triggers a targeted follow-up that attacks your weakest point</li>
                                <li>This continues for 5 rounds — each building on the last</li>
                                <li>You get AI coaching feedback when the session ends</li>
                            </ul>
                        </div>

                        <div className="pt-2 flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
                            <button
                                onClick={() => onConfirm(difficulty)}
                                className="w-full sm:w-auto px-12 py-4 bg-red-600 text-white font-black rounded-2xl hover:bg-red-500 transition-all uppercase tracking-[0.2em] text-[11px] shadow-[0_12px_30px_rgba(239,68,68,0.30)]"
                            >
                                Enter the Trap
                            </button>
                            <button
                                type="button"
                                onClick={onBack}
                                className="text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.3em] px-4"
                            >
                                Back to Modes
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-12">
                <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.35em]">Adversarial session ready</p>
            </div>
        </div>
    );
};

export default FollowupSetup;
