import React, { useEffect, useRef, useState, useCallback } from 'react';

interface CameraFeedProps {
  accentColor?: string;
}

type SizeKey = 'S' | 'M' | 'L';
const SIZES: Record<SizeKey, number> = { S: 200, M: 300, L: 420 };

const CameraFeed: React.FC<CameraFeedProps> = ({ accentColor = 'blue' }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const [visible, setVisible] = useState(false);
  const [permission, setPermission] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [mirrored, setMirrored] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [size, setSize] = useState<SizeKey>('S');

  const colorMap: Record<string, { ring: string; bg: string; dot: string }> = {
    blue:    { ring: 'ring-blue-500/50',    bg: 'bg-blue-600',    dot: 'bg-blue-400' },
    emerald: { ring: 'ring-emerald-500/50', bg: 'bg-emerald-600', dot: 'bg-emerald-400' },
    red:     { ring: 'ring-red-500/50',     bg: 'bg-red-600',     dot: 'bg-red-400' },
    orange:  { ring: 'ring-orange-500/50',  bg: 'bg-orange-600',  dot: 'bg-orange-400' },
  };
  const c = colorMap[accentColor] ?? colorMap.blue;

  // Attach stream to video element AFTER it mounts (fixes blank screen)
  useEffect(() => {
    if (visible && !minimized && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [visible, minimized]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setPermission('granted');
      setVisible(true); // render video element first; useEffect above attaches stream
    } catch {
      setPermission('denied');
      setVisible(true); // show panel so user sees the error
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setVisible(false);
    setPermission('idle');
  }, []);

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  // Drag
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: dragRef.current.origX - (e.clientX - dragRef.current.startX),
        y: dragRef.current.origY - (e.clientY - dragRef.current.startY),
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  const cycleSize = () => setSize(s => s === 'S' ? 'M' : s === 'M' ? 'L' : 'S');

  return (
    <>
      {/* Toggle button in control bar */}
      <button
        onClick={() => visible ? stopCamera() : startCamera()}
        title={visible ? 'Turn off camera' : 'Turn on camera'}
        className={`relative p-3.5 rounded-full border transition-all duration-300 ${
          visible
            ? `${c.bg} border-transparent shadow-lg`
            : 'bg-white/[0.04] border-white/10 hover:border-white/20 hover:bg-white/[0.08]'
        }`}
      >
        <svg className={`w-5 h-5 ${visible ? 'text-white' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M4 8h8a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4a2 2 0 012-2z" />
          {!visible && <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />}
        </svg>
        {visible && <span className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-full ${c.dot} animate-pulse`} />}
      </button>

      {/* Floating PiP window */}
      {visible && (
        <div
          className={`fixed z-50 select-none ${dragging ? 'cursor-grabbing' : ''}`}
          style={{
            right: `${Math.max(8, pos.x + 20)}px`,
            bottom: `${Math.max(8, pos.y + 100)}px`,
            width: minimized ? '52px' : `${SIZES[size]}px`,
            transition: dragging ? 'none' : 'width 0.2s ease',
          }}
        >
          {/* Header / drag handle */}
          <div
            onMouseDown={onMouseDown}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-t-2xl cursor-grab active:cursor-grabbing"
            style={{ background: 'rgba(8,10,18,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${c.dot} animate-pulse`} />
              {!minimized && <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Self View</span>}
            </div>

            {!minimized && (
              <div className="flex items-center gap-1 ml-2">
                {/* Size cycle: S → M → L → S */}
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={cycleSize}
                  title={`Size: ${size} — click to cycle S / M / L`}
                  className="w-5 h-5 flex items-center justify-center rounded text-[8px] font-black text-slate-500 hover:text-white hover:bg-white/10 transition-colors border border-white/10"
                >
                  {size}
                </button>

                {/* Mirror toggle */}
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => setMirrored(m => !m)}
                  title="Flip mirror"
                  className={`p-0.5 rounded transition-colors ${mirrored ? 'text-white' : 'text-slate-600'} hover:text-white hover:bg-white/10`}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v18M4 7l4-4 4 4M4 17l4 4 4-4" />
                  </svg>
                </button>

                {/* Close */}
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={stopCamera}
                  title="Close camera"
                  className="p-0.5 rounded text-slate-600 hover:text-red-400 hover:bg-white/10 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Minimise toggle — always shown */}
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setMinimized(m => !m)}
              title={minimized ? 'Expand' : 'Minimise'}
              className="ml-1 p-0.5 rounded text-slate-600 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={minimized ? 'M4 9l8-6 8 6' : 'M4 15l8 6 8-6'} />
              </svg>
            </button>
          </div>

          {/* Video panel */}
          {!minimized && (
            <div
              className={`relative overflow-hidden rounded-b-2xl ring-1 ${c.ring} bg-black shadow-2xl`}
              style={{ aspectRatio: '16/9' }}
            >
              {permission === 'denied' ? (
                <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">
                  <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Camera blocked</p>
                  <p className="text-[9px] text-slate-500 leading-relaxed">Allow camera in browser, then toggle again.</p>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: mirrored ? 'scaleX(-1)' : 'none', display: 'block' }}
                  />
                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)' }} />
                  <div className="absolute top-2 left-2.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[8px] font-black text-white/50 uppercase tracking-widest">REC</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default CameraFeed;

