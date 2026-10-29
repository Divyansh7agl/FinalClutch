
import React, { useState, useEffect } from 'react';
import { AppState, SimulationMode, PerformanceMetrics, SessionData, CustomContext, DifficultyLevel, ResumeContext } from './types';
import HomeScreen from './components/HomeScreen';
import ModeSelect from './components/ModeSelect';
import VivaSetup from './components/VivaSetup';
import PanicSetup from './components/PanicSetup';
import AIInterviewSetup from './components/AIInterviewSetup';
import Simulation from './components/Simulation';
import ReportScreen from './components/ReportScreen';
import CustomSetup from './components/CustomSetup';
import FollowupSetup from './components/FollowupSetup';
import AuthModal from './components/AuthModal';
import { useAuth } from './src/context/AuthContext';

type AppScreen = AppState | 'viva-setup' | 'panic-setup' | 'ai-interview-setup' | 'followup-setup';

const App: React.FC = () => {
  const { currentUser, loading, isFirebaseConfigured } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('home');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [mode, setMode] = useState<SimulationMode | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [lastMetrics, setLastMetrics] = useState<PerformanceMetrics | null>(null);
  const [history, setHistory] = useState<SessionData[]>([]);
  const [customContext, setCustomContext] = useState<CustomContext | null>(null);
  const [aiResumeContext, setAiResumeContext] = useState<ResumeContext | null>(null);

  // Guard simulation screens: Require signed-in & email-verified user
  useEffect(() => {
    if (isFirebaseConfigured && !loading) {
      if (!currentUser || !currentUser.emailVerified) {
        if (currentScreen !== 'home' && currentScreen !== 'report') {
          setCurrentScreen('home');
          setIsAuthModalOpen(true);
        }
      }
    }
  }, [currentUser, isFirebaseConfigured, loading, currentScreen]);

  // Load user-scoped history from local storage
  useEffect(() => {
    const storageKey = currentUser ? `clutchai_history_${currentUser.uid}` : 'clutchai_history';
    const saved = localStorage.getItem(storageKey) || localStorage.getItem('clutchai_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
    if (typeof window !== 'undefined' && window.location.search.includes('screen=report')) {
      setCurrentScreen('report');
      setLastMetrics({
        confidence: 78,
        clarity: 82,
        composure: 80,
        structure: 75,
        avgDelay: 2200,
        fillerCount: 2,
        transcript: 'I used a sliding window technique with two pointers to find the longest substring without duplicate characters.',
        responses: [
          {
            questionText: 'How do you find the length of the longest substring without duplicate characters?',
            transcript: 'I used a sliding window technique with two pointers.',
            delay: 2200,
            fillerCount: 2
          }
        ]
      });
    }
  }, [currentUser]);

  const handleStart = () => {
    if (isFirebaseConfigured) {
      if (!currentUser || !currentUser.emailVerified) {
        setIsAuthModalOpen(true);
        return;
      }
    }
    setCurrentScreen('mode-select');
  };

  const handleBackToHome = () => {
    setCurrentScreen('home');
    setMode(null);
    setDifficulty('medium');
    setCustomContext(null);
    setAiResumeContext(null);
  };

  const handleModeSelect = (selectedMode: SimulationMode) => {
    setMode(selectedMode);
    if (selectedMode !== 'ai-interview') {
      setAiResumeContext(null);
    }
    // Route to appropriate setup screen
    switch (selectedMode) {
      case 'viva':
        setCurrentScreen('viva-setup');
        break;
      case 'panic':
        setCurrentScreen('panic-setup');
        break;
      case 'ai-interview':
        setCurrentScreen('ai-interview-setup');
        break;
      case 'custom':
        setCurrentScreen('custom-setup');
        break;
      case 'followup':
        setCurrentScreen('followup-setup');
        break;
    }
  };

  const handleFollowupSetupConfirm = (selectedDifficulty: DifficultyLevel) => {
    setDifficulty(selectedDifficulty);
    setCurrentScreen('simulation');
  };

  const handleVivaSetupConfirm = (selectedDifficulty: DifficultyLevel) => {
    setDifficulty(selectedDifficulty);
    setCurrentScreen('simulation');
  };

  const handlePanicSetupConfirm = (selectedDifficulty: DifficultyLevel) => {
    setDifficulty(selectedDifficulty);
    setCurrentScreen('simulation');
  };

  const handleAIInterviewSetupConfirm = (selectedDifficulty: DifficultyLevel, resumeContext?: ResumeContext) => {
    setDifficulty(selectedDifficulty);
    setAiResumeContext(resumeContext || null);
    setCurrentScreen('simulation');
  };

  const handleCustomConfirm = (context: CustomContext) => {
    setCustomContext(context);
    setDifficulty(context.difficulty);
    setCurrentScreen('simulation');
  };

  const handleSimulationComplete = (metrics: PerformanceMetrics) => {
    setLastMetrics(metrics);
    const newSession: SessionData = {
      mode: mode!,
      metrics,
      timestamp: Date.now()
    };
    const updatedHistory = [newSession, ...history].slice(0, 5);
    setHistory(updatedHistory);
    const storageKey = currentUser ? `clutchai_history_${currentUser.uid}` : 'clutchai_history';
    localStorage.setItem(storageKey, JSON.stringify(updatedHistory));
    setCurrentScreen('report');
  };

  const handleRetry = () => {
    setCurrentScreen('simulation');
  };

  const handleBackToModes = () => {
    setCurrentScreen('mode-select');
    setAiResumeContext(null);
  };

  return (
    <div className={`relative w-full h-screen ${currentScreen === 'simulation' ? 'overflow-hidden' : 'overflow-y-auto'} text-slate-100 bg-transparent`}>
      {currentScreen === 'home' && (
        <HomeScreen
          onStart={handleStart}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />
      )}
      {currentScreen === 'mode-select' && (
        <ModeSelect onSelect={handleModeSelect} onHome={handleBackToHome} />
      )}
      {currentScreen === 'viva-setup' && (
        <VivaSetup onConfirm={handleVivaSetupConfirm} onBack={() => setCurrentScreen('mode-select')} />
      )}
      {currentScreen === 'panic-setup' && (
        <PanicSetup onConfirm={handlePanicSetupConfirm} onBack={() => setCurrentScreen('mode-select')} />
      )}
      {currentScreen === 'ai-interview-setup' && (
        <AIInterviewSetup onConfirm={handleAIInterviewSetupConfirm} onBack={() => setCurrentScreen('mode-select')} />
      )}
      {currentScreen === 'custom-setup' && (
        <CustomSetup onConfirm={handleCustomConfirm} onBack={() => setCurrentScreen('mode-select')} />
      )}
      {currentScreen === 'followup-setup' && (
        <FollowupSetup onConfirm={handleFollowupSetupConfirm} onBack={() => setCurrentScreen('mode-select')} />
      )}
      {currentScreen === 'simulation' && mode && (
        <Simulation
          mode={mode}
          customContext={
            mode === 'custom'
              ? customContext || undefined
              : {
                  role: '',
                  topic: '',
                  difficulty,
                  resumeContext: mode === 'ai-interview' ? aiResumeContext || undefined : undefined,
                }
          }
          onComplete={handleSimulationComplete}
          onQuit={() => setCurrentScreen('mode-select')}
        />
      )}
      {currentScreen === 'report' && lastMetrics && (
        <ReportScreen
          metrics={lastMetrics}
          previousMetrics={history.length > 1 ? history[1].metrics : null}
          onRetry={handleRetry}
          onBack={handleBackToModes}
          onHome={handleBackToHome}
        />
      )}

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          setIsAuthModalOpen(false);
          setCurrentScreen('mode-select');
        }}
      />
    </div>
  );
};

export default App;
