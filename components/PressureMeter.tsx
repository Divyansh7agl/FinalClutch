
import React from 'react';

interface PressureMeterProps {
  score: number; // 0 to 100
}

const PressureMeter: React.FC<PressureMeterProps> = ({ score }) => {
  // Rotate from -90deg (0) to 90deg (100)
  const rotation = (score / 100) * 180 - 90;
  const isHigh = score > 70;

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-4">
      <div className="relative w-48 h-24 overflow-hidden">
        {/* The Gauge Arch */}
        <svg className="w-full h-full transform" viewBox="0 0 100 50">
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="#1e293b"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke={isHigh ? "#ef4444" : "#3b82f6"}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="125.6"
            strokeDashoffset={125.6 - (score / 100) * 125.6}
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* The Needle */}
        <div 
          className="absolute bottom-0 left-1/2 w-1 h-20 bg-white origin-bottom rounded-full gauge-transition"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        />
        
        {/* Center pivot */}
        <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full border-4 border-slate-900 shadow-lg" />
      </div>
      
      <div className="text-center">
        <span className={`text-2xl font-black tracking-tighter ${isHigh ? 'text-red-500' : 'text-blue-500'}`}>
          {Math.round(score)}%
        </span>
        <div className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-500">
          Pressure Index
        </div>
      </div>
    </div>
  );
};

export default PressureMeter;
