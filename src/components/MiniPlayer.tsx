import React, { useEffect, useRef, useState } from 'react';
import { emit, listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Play, Pause, SkipBack, SkipForward, Pin, PinOff, Maximize2, X } from 'lucide-react';
import CachedImage from './CachedImage';
import { buildCoverArtUrl, coverArtCacheKey } from '../api/subsonic';
import type { MiniSyncPayload, MiniControlAction } from '../utils/miniPlayerBridge';

interface ProgressPayload {
  current_time: number;
  duration: number;
}

function fmt(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MiniPlayer() {
  const [state, setState] = useState<MiniSyncPayload>({ track: null, isPlaying: false, isMobile: false });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const ticker = useRef<number | null>(null);

  // Announce to main window that we're mounted; it replies with a snapshot.
  useEffect(() => {
    emit('mini:ready', {}).catch(() => {});
  }, []);

  // Keyboard: Space → toggle, ← / → → prev / next. Ignore when typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      const tag = tgt?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tgt?.isContentEditable) return;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        emit('mini:control', 'toggle').catch(() => {});
      } else if (e.key === 'ArrowRight') {
        emit('mini:control', 'next').catch(() => {});
      } else if (e.key === 'ArrowLeft') {
        emit('mini:control', 'prev').catch(() => {});
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Subscribe to state + progress from the main window / Rust.
  useEffect(() => {
    const unSync = listen<MiniSyncPayload>('mini:sync', (e) => {
      setState(e.payload);
      if (e.payload.track?.duration) setDuration(e.payload.track.duration);
    });
    const unProgress = listen<ProgressPayload>('audio:progress', (e) => {
      setCurrentTime(e.payload.current_time);
      if (e.payload.duration > 0) setDuration(e.payload.duration);
    });
    const unEnded = listen('audio:ended', () => setCurrentTime(0));
    return () => {
      unSync.then(fn => fn()).catch(() => {});
      unProgress.then(fn => fn()).catch(() => {});
      unEnded.then(fn => fn()).catch(() => {});
      if (ticker.current) window.clearInterval(ticker.current);
    };
  }, []);

  const control = (action: MiniControlAction) => emit('mini:control', action).catch(() => {});

  const toggleOnTop = async () => {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    try { await invoke('set_mini_player_always_on_top', { onTop: next }); } catch {}
  };

  const closeMini = async () => {
    try { await invoke('close_mini_player'); } catch {}
  };

  const showMain = () => invoke('show_main_window').catch(() => {});

  const { track, isPlaying } = state;
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="mini-player">
      <div className="mini-player__art">
        {track?.coverArt ? (
          <CachedImage
            src={buildCoverArtUrl(track.coverArt, 300)}
            cacheKey={coverArtCacheKey(track.coverArt, 300)}
            alt={track.album}
          />
        ) : (
          <div className="mini-player__art-fallback" />
        )}
      </div>

      <div className="mini-player__body">
        <div className="mini-player__titles">
          <div className="mini-player__title" title={track?.title}>
            {track?.title ?? '—'}
          </div>
          <div className="mini-player__artist" title={track?.artist}>
            {track?.artist ?? ''}
          </div>
        </div>

        <div className="mini-player__controls">
          <button className="mini-player__btn" onClick={() => control('prev')} data-tauri-drag-region="false">
            <SkipBack size={16} />
          </button>
          <button className="mini-player__btn mini-player__btn--primary" onClick={() => control('toggle')}>
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button className="mini-player__btn" onClick={() => control('next')}>
            <SkipForward size={16} />
          </button>
        </div>

        <div className="mini-player__progress">
          <div className="mini-player__progress-time">{fmt(currentTime)}</div>
          <div className="mini-player__progress-track">
            <div className="mini-player__progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="mini-player__progress-time">{fmt(duration)}</div>
        </div>
      </div>

      <div className="mini-player__toolbar">
        <button
          className={`mini-player__tool${alwaysOnTop ? ' mini-player__tool--active' : ''}`}
          onClick={toggleOnTop}
          data-tooltip={alwaysOnTop ? 'Pin off' : 'Pin on top'}
        >
          {alwaysOnTop ? <Pin size={13} /> : <PinOff size={13} />}
        </button>
        <button className="mini-player__tool" onClick={showMain} data-tooltip="Open main window">
          <Maximize2 size={13} />
        </button>
        <button className="mini-player__tool" onClick={closeMini} data-tooltip="Close">
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
