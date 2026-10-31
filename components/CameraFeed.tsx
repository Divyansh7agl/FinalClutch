import React, { useCallback, useEffect, useRef, useState } from 'react';

interface CameraFeedProps {
  accentColor?: string;
  compact?: boolean;
}

const CameraFeed: React.FC<CameraFeedProps> = ({ accentColor = 'blue', compact = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [mirrored, setMirrored] = useState(true);

  const colors: Record<string, { border: string; badge: string; dot: string }> = {
    blue: { border: 'border-blue-500/30', badge: 'bg-blue-500', dot: 'bg-blue-400' },
    emerald: { border: 'border-emerald-500/30', badge: 'bg-emerald-500', dot: 'bg-emerald-400' },
    red: { border: 'border-red-500/30', badge: 'bg-red-500', dot: 'bg-red-400' },
    orange: { border: 'border-orange-500/30', badge: 'bg-orange-500', dot: 'bg-orange-400' },
  };
  const color = colors[accentColor] || colors.blue;

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionDenied(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setPermissionDenied(false);
      setCameraOn(true);
    } catch (error) {
      console.error('[Camera] Unable to access camera:', error);
      setPermissionDenied(true);
      setCameraOn(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  useEffect(() => {
    void startCamera();
    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [startCamera]);

  useEffect(() => {
    if (!videoRef.current || !streamRef.current || !cameraOn) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(error => {
      console.warn('[Camera] Playback could not start automatically:', error);
    });
  }, [cameraOn]);

  return (
    <div className={`w-full rounded-3xl border ${color.border} bg-white/[0.03] ${compact ? 'p-3' : 'p-5'} backdrop-blur-2xl`}>
      <div className={`flex items-center justify-between ${compact ? 'mb-2' : 'mb-3'}`}>
        <div>
          <p className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-black uppercase tracking-[0.3em] text-slate-400`}>Your camera</p>
          {!compact && <p className="text-xs text-slate-600 mt-1">{cameraOn ? 'Visible to you in this practice session' : 'Camera off'}</p>}
        </div>
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-white ${cameraOn ? color.badge : 'bg-slate-700'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${cameraOn ? `${color.dot} animate-pulse` : 'bg-slate-400'}`} />
          {cameraOn ? 'On' : 'Off'}
        </span>
      </div>

      <div className="relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950">
        {cameraOn ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`h-full w-full object-cover ${mirrored ? '-scale-x-100' : ''}`}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-700 text-2xl font-black text-slate-300">You</div>
            <span className="mt-3 text-[10px] uppercase tracking-widest text-slate-500">
              {permissionDenied ? 'Camera unavailable' : 'Camera off'}
            </span>
          </div>
        )}
      </div>

      <div className={`${compact ? 'mt-2' : 'mt-3'} flex items-center justify-end gap-2`}>
        {cameraOn && !compact && (
          <button
            onClick={() => setMirrored(value => !value)}
            className="rounded-lg border border-white/10 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:border-white/20 hover:text-white"
          >
            {mirrored ? 'Unmirror' : 'Mirror'}
          </button>
        )}
        <button
          onClick={cameraOn ? stopCamera : startCamera}
          className="rounded-lg border border-white/10 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:border-white/20 hover:text-white"
        >
          {cameraOn ? 'Turn camera off' : 'Turn camera on'}
        </button>
      </div>
    </div>
  );
};

export default CameraFeed;
