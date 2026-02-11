
import React, { useState } from 'react';
import { CustomContext, DifficultyLevel } from '../types';

interface CustomSetupProps {
    onConfirm: (context: CustomContext) => void;
    onBack: () => void;
}

const CustomSetup: React.FC<CustomSetupProps> = ({ onConfirm, onBack }) => {
    const [role, setRole] = useState('');
    const [topic, setTopic] = useState('');
    const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (role.trim() && topic.trim()) {
            onConfirm({ role, topic, difficulty });
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-full py-16 px-6 bg-[#0a0c10]">
            <div className="mb-8 text-center">
                <h1 className="text-xl font-black tracking-tighter text-white opacity-50 italic uppercase">Neural.Configuration</h1>
            </div>

            <div className="max-w-2xl w-full glass-card p-12 rounded-[2.5rem] border border-orange-500/20 shadow-[0_0_80px_rgba(249,115,22,0.05)] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 text-8xl opacity-5 font-serif italic text-orange-500">C</div>

                <div className="relative z-10">
                    <h2 className="text-3xl font-bold mb-2 text-white">Custom Protocol</h2>
                    <p className="text-slate-500 mb-10 text-sm font-medium tracking-wide">Define your training parameters to personalize the AI engagement.</p>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500 ml-1">Target Designation (Role)</label>
                            <input
                                autoFocus
                                type="text"
                                placeholder="e.g., Senior Software Architect"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-white placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all font-medium"
                                required
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500 ml-1">Primary Objective (Topic)</label>
                            <input
                                type="text"
                                placeholder="e.g., Distributed Systems & Scalability"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-white placeholder:text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all font-medium"
                                required
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500 ml-1">Difficulty Level</label>
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setDifficulty('easy')}
                                    className={`px-6 py-4 rounded-2xl font-bold uppercase tracking-wider text-xs transition-all ${difficulty === 'easy'
                                            ? 'bg-green-500 text-black shadow-[0_0_30px_rgba(34,197,94,0.4)] scale-105'
                                            : 'bg-black/40 border border-white/5 text-slate-500 hover:text-white hover:border-green-500/30'
                                        }`}
                                >
                                    Easy
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDifficulty('medium')}
                                    className={`px-6 py-4 rounded-2xl font-bold uppercase tracking-wider text-xs transition-all ${difficulty === 'medium'
                                            ? 'bg-orange-500 text-black shadow-[0_0_30px_rgba(249,115,22,0.4)] scale-105'
                                            : 'bg-black/40 border border-white/5 text-slate-500 hover:text-white hover:border-orange-500/30'
                                        }`}
                                >
                                    Medium
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDifficulty('hard')}
                                    className={`px-6 py-4 rounded-2xl font-bold uppercase tracking-wider text-xs transition-all ${difficulty === 'hard'
                                            ? 'bg-red-500 text-black shadow-[0_0_30px_rgba(239,68,68,0.4)] scale-105'
                                            : 'bg-black/40 border border-white/5 text-slate-500 hover:text-white hover:border-red-500/30'
                                        }`}
                                >
                                    Hard
                                </button>
                            </div>
                        </div>

                        <div className="pt-6 flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
                            <button
                                type="submit"
                                className="w-full sm:w-auto px-12 py-4 bg-orange-500 text-black font-black rounded-2xl hover:bg-orange-400 transition-all uppercase tracking-[0.2em] text-[11px] shadow-[0_0_40px_rgba(249,115,22,0.3)]"
                            >
                                Engage Simulation
                            </button>
                            <button
                                type="button"
                                onClick={onBack}
                                className="text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.3em] px-4"
                            >
                                Abort Setup
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="mt-12 group cursor-default">
                <p className="text-[8px] font-black text-slate-700 uppercase tracking-[1em] group-hover:text-orange-500/40 transition-colors">Neural Sync Optimized for Precision</p>
            </div>
        </div>
    );
};


export default CustomSetup;
