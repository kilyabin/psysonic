import { useEffect, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { useOrbitStore } from '../store/orbitStore';
import { usePlayerStore, songToTrack } from '../store/playerStore';
import { getSong } from '../api/subsonic';
import {
  endOrbitSession,
  leaveOrbitSession,
  computeOrbitDriftMs,
} from '../utils/orbit';
import { ORBIT_SHUFFLE_INTERVAL_MS } from '../utils/orbit';
import { estimateLivePosition } from '../api/orbit';

/**
 * Orbit — top-strip session indicator.
 *
 * Visible whenever the local store reports an active (or just-ended)
 * session. Shows session name, host, participant count, shuffle countdown,
 * and role-appropriate action buttons (catch-up for guests, exit for
 * everyone).
 *
 * Deliberately low-chrome: sits above the rest of the app without
 * reshaping the layout.
 */

const CATCH_UP_DRIFT_THRESHOLD_MS = 3_000;

function formatCountdown(ms: number): string {
  const clamped = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function OrbitSessionBar() {
  const state              = useOrbitStore(s => s.state);
  const role               = useOrbitStore(s => s.role);
  const phase              = useOrbitStore(s => s.phase);
  const [nowMs, setNowMs]  = useState(() => Date.now());

  // Second-level tick just for the shuffle countdown + drift readout —
  // the store itself only ticks at 2.5 s which is too coarse for a smooth
  // countdown.
  useEffect(() => {
    if (!state || phase !== 'active') return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state, phase]);

  if (!state || (phase !== 'active' && phase !== 'ended')) return null;

  const untilShuffle = Math.max(0, (state.lastShuffle + ORBIT_SHUFFLE_INTERVAL_MS) - nowMs);

  // Guest-only: detect drift from the host's estimated live position.
  const guestPlayback = usePlayerStore.getState();
  const localPositionMs = Math.round((guestPlayback.currentTime ?? 0) * 1000);
  const driftMs = role === 'guest' && state.currentTrack && guestPlayback.currentTrack?.id === state.currentTrack.trackId
    ? computeOrbitDriftMs(state, localPositionMs, nowMs)
    : null;
  const showCatchUp = role === 'guest'
    && state.isPlaying
    && state.currentTrack
    && (driftMs == null || Math.abs(driftMs) > CATCH_UP_DRIFT_THRESHOLD_MS);

  const onExit = async () => {
    try {
      if (role === 'host') await endOrbitSession();
      else if (role === 'guest') await leaveOrbitSession();
      else useOrbitStore.getState().reset();
    } catch {
      useOrbitStore.getState().reset();
    }
  };

  const onCatchUp = async () => {
    if (!state.currentTrack) return;
    const trackId = state.currentTrack.trackId;
    const targetMs = estimateLivePosition(state, Date.now());
    const targetSec = Math.max(0, targetMs / 1000);
    try {
      const song = await getSong(trackId);
      if (!song) return;
      const track = songToTrack(song);
      const player = usePlayerStore.getState();
      if (player.currentTrack?.id === trackId) {
        // Same track: just seek + resume.
        player.seek(targetSec / Math.max(1, track.duration));
        if (!player.isPlaying) player.resume();
      } else {
        // Different track: play + seek on next tick once engine is ready.
        player.playTrack(track, [track]);
        // Best-effort: seek to the host's position a beat later.
        window.setTimeout(() => {
          const p = usePlayerStore.getState();
          if (p.currentTrack?.id === trackId) {
            p.seek(targetSec / Math.max(1, track.duration));
          }
        }, 400);
      }
    } catch {
      // silent — if the track is gone from the host's library, nothing we can do.
    }
  };

  const participantCount = state.participants.length + 1; // +1 for the host

  return (
    <div className="orbit-bar">
      <div className="orbit-bar__left">
        <span className="orbit-bar__dot" aria-hidden="true" />
        <span className="orbit-bar__name">{state.name}</span>
        <span className="orbit-bar__sep">·</span>
        <span className="orbit-bar__count">{participantCount}/{state.maxUsers}</span>
        <span className="orbit-bar__sep">·</span>
        <span className="orbit-bar__host">host: @{state.host}</span>
      </div>

      <div className="orbit-bar__center">
        <span className="orbit-bar__shuffle" data-tooltip="Queue reshuffles on this timer">
          🔀 {formatCountdown(untilShuffle)}
        </span>
      </div>

      <div className="orbit-bar__right">
        {showCatchUp && (
          <button
            type="button"
            className="orbit-bar__catchup"
            onClick={onCatchUp}
            data-tooltip="Jump to the host's current position"
          >
            <RefreshCw size={13} />
            <span>catch up</span>
          </button>
        )}
        <button
          type="button"
          className="orbit-bar__exit"
          onClick={onExit}
          data-tooltip={role === 'host' ? 'End session' : 'Leave session'}
          aria-label={role === 'host' ? 'End session' : 'Leave session'}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
