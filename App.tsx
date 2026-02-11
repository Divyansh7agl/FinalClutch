
import React, { useState, useEffect } from 'react';
import { AppState, SimulationMode, PerformanceMetrics, SessionData, CustomContext, DifficultyLevel } from './types';
import HomeScreen from './components/HomeScreen';
import ModeSelect from './components/ModeSelect';
import VivaSetup from './components/VivaSetup';
import PanicSetup from './components/PanicSetup';
import AIInterviewSetup from './components/AIInterviewSetup';
import Simulation from './components/Simulation';
import ReportScreen from './components/ReportScreen';
import CustomSetup from './components/CustomSetup';

type AppScreen = AppState | 'viva-setup' | 'panic-setup' | 'ai-interview-setup';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('home');
  const [mode, setMode] = useState<SimulationMode | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [lastMetrics, setLastMetrics] = useState<PerformanceMetrics | null>(null);
  const [history, setHistory] = useState<SessionData[]>([]);
  const [customContext, setCustomContext] = useState<CustomContext | null>(null);

  // Load history from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('clutchai_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const handleStart = () => {
    setCurrentScreen('mode-select');
  };

  const handleBackToHome = () => {
    setCurrentScreen('home');
    setMode(null);
    setDifficulty('medium');
    setCustomContext(null);
  };

  const handleModeSelect = (selectedMode: SimulationMode) => {
    setMode(selectedMode);
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
    }
  };

  const handleVivaSetupConfirm = (selectedDifficulty: DifficultyLevel) => {
    setDifficulty(selectedDifficulty);
    setCurrentScreen('simulation');
  };

  const handlePanicSetupConfirm = (selectedDifficulty: DifficultyLevel) => {
    setDifficulty(selectedDifficulty);
    setCurrentScreen('simulation');
  };

  const handleAIInterviewSetupConfirm = (selectedDifficulty: DifficultyLevel) => {
    setDifficulty(selectedDifficulty);
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
    localStorage.setItem('clutchai_history', JSON.stringify(updatedHistory));
    setCurrentScreen('report');
  };

  const handleRetry = () => {
    setCurrentScreen('simulation');
  };

  const handleBackToModes = () => {
    setCurrentScreen('mode-select');
  };

  return (
    <div className={`relative w-full h-screen ${currentScreen === 'simulation' ? 'overflow-hidden' : 'overflow-y-auto'} text-slate-100 bg-transparent`}>
      {currentScreen === 'home' && <HomeScreen onStart={handleStart} />}
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
      {currentScreen === 'simulation' && mode && (
        <Simulation
          mode={mode}
          customContext={mode === 'custom' ? customContext || undefined : { role: '', topic: '', difficulty }}
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
    </div>
  );
};

export default App;
