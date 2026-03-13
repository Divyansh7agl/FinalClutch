
import React, { useState } from 'react';
import { DifficultyLevel, ResumeContext } from '../types';
import { parseResumeFile } from '../src/utils/resumeParser';
import Logo from './Logo';

interface AIInterviewSetupProps {
    onConfirm: (difficulty: DifficultyLevel, resumeContext?: ResumeContext) => void;
    onBack: () => void;
}

const AIInterviewSetup: React.FC<AIInterviewSetupProps> = ({ onConfirm, onBack }) => {
    const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
    const [resumeContext, setResumeContext] = useState<ResumeContext | undefined>(undefined);
    const [isParsingResume, setIsParsingResume] = useState(false);
    const [resumeError, setResumeError] = useState('');

    const handleStart = () => {
        onConfirm(difficulty, resumeContext);
    };

    const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setResumeError('');
        setIsParsingResume(true);

        try {
            const parsed = await parseResumeFile(file);
            setResumeContext(parsed);
        } catch (error) {
            console.error('Resume parsing failed', error);
            setResumeContext(undefined);
            setResumeError(error instanceof Error ? error.message : 'Failed to parse resume file.');
        } finally {
            setIsParsingResume(false);
            event.target.value = '';
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-full py-16 px-6 bg-[#0a0c10]">
            <div className="mb-8 text-center">
                <Logo size="md" />
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">AI Interview Setup</p>
            </div>

            <div className="max-w-2xl w-full glass-card p-12 rounded-[2.5rem] border border-emerald-500/20 shadow-[0_20px_50px_rgba(16,185,129,0.10)] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 text-8xl opacity-5 font-serif italic text-emerald-500">A</div>

                <div className="relative z-10">
                    <h2 className="text-3xl font-bold mb-2 text-white">AI Interview Setup</h2>
                    <p className="text-slate-500 mb-10 text-sm font-medium tracking-wide">
                        Practice with conversational AI, dynamic follow-up prompts, and optional resume-based question targeting.
                    </p>

                    <div className="space-y-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500 ml-1">Difficulty Level</label>
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

                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500 ml-1">Resume Context (Optional)</label>
                            <div className="bg-black/40 border border-white/5 rounded-2xl p-5">
                                <input
                                    type="file"
                                    accept=".pdf,.docx,.txt"
                                    onChange={handleResumeUpload}
                                    className="block w-full text-xs text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-500/20 file:px-4 file:py-2 file:text-[10px] file:font-black file:uppercase file:tracking-wider file:text-emerald-400 hover:file:bg-emerald-500/30"
                                />
                                <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                                    Upload your resume to generate role-relevant interview questions.
                                </p>
                                {isParsingResume && (
                                    <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-emerald-400">Parsing resume...</p>
                                )}
                                {!isParsingResume && resumeContext && (
                                    <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-green-400">
                                        Resume loaded: {resumeContext.fileName}
                                    </p>
                                )}
                                {!!resumeError && (
                                    <p className="mt-2 text-[10px] uppercase tracking-[0.1em] text-red-400">{resumeError}</p>
                                )}
                            </div>
                        </div>

                        <div className="pt-6 flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
                            <button
                                onClick={handleStart}
                                disabled={isParsingResume}
                                className="w-full sm:w-auto px-12 py-4 bg-emerald-500 text-white font-black rounded-2xl hover:bg-emerald-400 transition-all uppercase tracking-[0.2em] text-[11px] shadow-[0_0_40px_rgba(16,185,129,0.3)]"
                            >
                                Start AI Session
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

            <div className="mt-12 group cursor-default">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.35em] group-hover:text-emerald-300/80 transition-colors">AI interview ready</p>
            </div>
        </div>
    );
};

export default AIInterviewSetup;
