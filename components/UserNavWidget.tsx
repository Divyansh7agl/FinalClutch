import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../src/context/AuthContext';

interface UserNavWidgetProps {
  onOpenAuth: () => void;
}

const UserNavWidget: React.FC<UserNavWidgetProps> = ({ onOpenAuth }) => {
  const { currentUser, loading, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse" />
    );
  }

  if (!currentUser) {
    return (
      <button
        onClick={onOpenAuth}
        className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-blue-600/20 border border-white/10 hover:border-blue-500/40 text-xs font-bold uppercase tracking-wider text-white transition-all shadow-sm group"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 group-hover:animate-ping" />
        <span>Sign In</span>
      </button>
    );
  }

  const initial = (currentUser.displayName || currentUser.email || 'U')[0].toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center space-x-2.5 p-1.5 pr-3 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all text-left"
      >
        {currentUser.photoURL ? (
          <img
            src={currentUser.photoURL}
            alt={currentUser.displayName || 'Avatar'}
            className="w-7 h-7 rounded-full object-cover border border-white/20"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[11px] font-black text-white shadow-sm">
            {initial}
          </div>
        )}

        <div className="hidden sm:block text-left">
          <p className="text-[11px] font-bold text-white leading-none truncate max-w-[110px]">
            {currentUser.displayName || currentUser.email?.split('@')[0]}
          </p>
        </div>

        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#0c0f15] border border-white/10 p-3 shadow-2xl shadow-black z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-white/5 mb-2">
            <p className="text-xs font-bold text-white truncate">
              {currentUser.displayName || 'Account'}
            </p>
            <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
              {currentUser.email}
            </p>
            <div className="mt-2 flex items-center space-x-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  currentUser.emailVerified ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span className="text-[10px] font-semibold text-slate-400">
                {currentUser.emailVerified ? 'Email Verified' : 'Email Pending Verification'}
              </span>
            </div>
          </div>

          {!currentUser.emailVerified && (
            <button
              onClick={() => {
                setDropdownOpen(false);
                onOpenAuth();
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-amber-300 hover:bg-amber-500/10 transition-colors mb-1 flex items-center space-x-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Complete Verification</span>
            </button>
          )}

          <button
            onClick={async () => {
              setDropdownOpen(false);
              await logout();
            }}
            className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors flex items-center space-x-2"
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default UserNavWidget;
