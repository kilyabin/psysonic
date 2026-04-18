import React, { useEffect, useRef, useState } from 'react';
import { emit, listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Play, Pause, SkipBack, SkipForward, Pin, PinOff, Maximize2, X, ListMusic } from 'lucide-react';
import CachedImage from './CachedImage';
import { buildCoverArtUrl, coverArtCacheKey } from '../api/subsonic';
import { usePlayerStore } from '../store/playerStore';
import type { MiniSyncPayload, MiniControlAction, MiniTrackInfo } from '../utils/miniPlayerBridge';

const COLLAPSED_SIZE = { w: 340, h: 180 };
const EXPANDED_SIZE  = { w: 340, h: 440 };

function toMini(t: any): MiniTrackInfo {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    album: t.album,
    albumId: t.albumId,
    artistId: t.artistId,
    coverArt: t.coverArt,
    duration: t.duration,
    starred: !!t.starred,
  };
}

/**
 * Hydrate from the persisted playerStore so initial paint shows real content
 * instead of "—" while we wait for the mini:sync event from the main window.
 * The persisted state covers the cold-start window (webview boot + bundle).
 */
function initialSnapshot(): MiniSyncPayload {
  try {
    const s = usePlayerStore.getState();
    return {
      track: s.currentTrack ? toMini(s.currentTrack) : null,
      queue: (s.queue ?? []).map(toMini),
      queueIndex: s.queueIndex ?? 0,
      isPlaying: s.isPlaying,
      isMobile: false,
    };
  } catch {
    return { track: null, queue: [], queueIndex: 0, isPlaying: false, isMobile: false };
  }
}

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
  const [state, setState] = useState<MiniSyncPayload>(() => initialSnapshot());
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(() => {
    const initial = initialSnapshot();
    return initial.track?.duration ?? 0;
  });
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [queueOpen, setQueueOpen] = useState(false);
  const ticker = useRef<number | null>(null);
  const queueScrollRef = useRef<HTMLDivElement>(null);

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

  const toggleQueue = async () => {
    const next = !queueOpen;
    setQueueOpen(next);
    const size = next ? EXPANDED_SIZE : COLLAPSED_SIZE;
    try { await invoke('resize_mini_player', { width: size.w, height: size.h }); } catch {}
  };

  const jumpTo = (index: number) => emit('mini:jump', { index }).catch(() => {});

  // Auto-scroll the current track into view when the queue expands.
  useEffect(() => {
    if (!queueOpen) return;
    const el = queueScrollRef.current?.querySelector<HTMLElement>('.mini-queue__item--current');
    el?.scrollIntoView({ block: 'nearest' });
  }, [queueOpen, state.queueIndex]);

  const { track, isPlaying } = state;
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className={`mini-player${queueOpen ? ' mini-player--queue-open' : ''}`}>
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
          className={`mini-player__tool${queueOpen ? ' mini-player__tool--active' : ''}`}
          onClick={toggleQueue}
          data-tooltip={queueOpen ? 'Hide queue' : 'Show queue'}
        >
          <ListMusic size={13} />
        </button>
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

      {queueOpen && (
        <div className="mini-queue" ref={queueScrollRef}>
          {state.queue.length === 0 ? (
            <div className="mini-queue__empty">Queue is empty</div>
          ) : (
            state.queue.map((t, i) => (
              <button
                key={`${t.id}-${i}`}
                className={`mini-queue__item${i === state.queueIndex ? ' mini-queue__item--current' : ''}`}
                onClick={() => jumpTo(i)}
              >
                <span className="mini-queue__num">{i + 1}</span>
                <div className="mini-queue__meta">
                  <div className="mini-queue__title">{t.title}</div>
                  <div className="mini-queue__artist">{t.artist}</div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
