
import React, { useState, useEffect } from 'react';
import { AppState, SimulationMode, PerformanceMetrics, SessionData, CustomContext } from './types';
import HomeScreen from './components/HomeScreen';
import ModeSelect from './components/ModeSelect';
import Simulation from './components/Simulation';
import ReportScreen from './components/ReportScreen';
import CustomSetup from './components/CustomSetup';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<AppState>('home');
  const [mode, setMode] = useState<SimulationMode | null>(null);
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
    setCustomContext(null);
  };

  const handleModeSelect = (selectedMode: SimulationMode) => {
    setMode(selectedMode);
    if (selectedMode === 'custom') {
      setCurrentScreen('custom-setup');
    } else {
      setCurrentScreen('simulation');
    }
  };

  const handleCustomConfirm = (context: CustomContext) => {
    setCustomContext(context);
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
      {currentScreen === 'custom-setup' && (
        <CustomSetup onConfirm={handleCustomConfirm} onBack={() => setCurrentScreen('mode-select')} />
      )}
      {currentScreen === 'simulation' && mode && (
        <Simulation
          mode={mode}
          customContext={customContext || undefined}
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
