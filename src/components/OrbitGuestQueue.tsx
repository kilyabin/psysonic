import { useEffect, useMemo, useState } from 'react';
import { Radio, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOrbitStore } from '../store/orbitStore';
import {
  getSong,
  buildCoverArtUrl,
  coverArtCacheKey,
  type SubsonicSong,
} from '../api/subsonic';
import CachedImage from './CachedImage';

/**
 * Orbit — guest-side queue view.
 *
 * Rendered in place of the normal QueuePanel contents while `role === 'guest'`.
 * Read-only: shows the host's current track + every guest-submitted suggestion
 * (including ours). No reorder / remove / save — those belong to the host.
 *
 * Track metadata is resolved lazily via `getSong` and cached locally so the
 * list doesn't flicker while the 2.5 s state tick refreshes `state.queue`.
 */
export default function OrbitGuestQueue() {
  const { t } = useTranslation();
  const state        = useOrbitStore(s => s.state);
  const queueItems   = state?.queue ?? [];
  const currentTrack = state?.currentTrack ?? null;

  // Local song cache — keyed by trackId. Survives parent re-renders triggered
  // by the store tick so list rows don't remount and recomputed URLs don't
  // kick off duplicate `getSong` calls.
  const [songs, setSongs] = useState<Record<string, SubsonicSong>>({});

  // Track IDs we need but don't yet have. String-joined so useEffect deps
  // stay stable across identical queue snapshots (e.g. reshuffle).
  const wantedKey = useMemo(() => {
    const ids: string[] = [];
    if (currentTrack) ids.push(currentTrack.trackId);
    queueItems.forEach(q => ids.push(q.trackId));
    return Array.from(new Set(ids)).sort().join('|');
  }, [currentTrack, queueItems]);

  useEffect(() => {
    const wanted = wantedKey ? wantedKey.split('|') : [];
    const missing = wanted.filter(id => id && !songs[id]);
    if (missing.length === 0) return;

    let cancelled = false;
    void Promise.all(missing.map(id => getSong(id).catch(() => null)))
      .then(results => {
        if (cancelled) return;
        setSongs(prev => {
          const next = { ...prev };
          results.forEach((s, i) => { if (s) next[missing[i]] = s; });
          return next;
        });
      });
    return () => { cancelled = true; };
  }, [wantedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return null;

  const currentSong = currentTrack ? songs[currentTrack.trackId] : null;

  return (
    <div className="orbit-guest-queue">
      <div className="orbit-guest-queue__head">
        <h2 className="orbit-guest-queue__title">{state.name}</h2>
        <div className="orbit-guest-queue__meta">
          <Users size={11} /> {state.participants.length + 1} · {t('orbit.guestHost', { name: state.host })}
        </div>
      </div>

      {currentTrack && (
        <div className="orbit-guest-queue__current">
          <div className="orbit-guest-queue__live-badge">
            <Radio size={10} /> {t('orbit.guestLive')}
          </div>
          <div className="orbit-guest-queue__current-body">
            {currentSong?.coverArt ? (
              <CachedImage
                src={buildCoverArtUrl(currentSong.coverArt, 96)}
                cacheKey={coverArtCacheKey(currentSong.coverArt, 96)}
                alt=""
                className="orbit-guest-queue__cover orbit-guest-queue__cover--lg"
              />
            ) : (
              <div className="orbit-guest-queue__cover orbit-guest-queue__cover--lg orbit-guest-queue__cover--ph" />
            )}
            <div className="orbit-guest-queue__info">
              <div className="orbit-guest-queue__track-title">
                {currentSong?.title ?? t('orbit.guestLoading')}
              </div>
              <div className="orbit-guest-queue__track-artist">
                {currentSong?.artist ?? ''}
              </div>
              <div className="orbit-guest-queue__note">
                {state.isPlaying ? t('orbit.guestPlaying') : t('orbit.guestPaused')}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="orbit-guest-queue__section-head">
        {t('orbit.guestSuggestions')} <span className="orbit-guest-queue__count">{queueItems.length}</span>
      </div>

      <div className="orbit-guest-queue__list">
        {queueItems.length === 0 && (
          <div className="orbit-guest-queue__empty">{t('orbit.guestEmpty')}</div>
        )}

        {queueItems.map((q, i) => {
          const song = songs[q.trackId];
          return (
            <div
              key={`${q.addedBy}-${q.addedAt}-${q.trackId}-${i}`}
              className="orbit-guest-queue__item"
            >
              {song?.coverArt ? (
                <CachedImage
                  src={buildCoverArtUrl(song.coverArt, 48)}
                  cacheKey={coverArtCacheKey(song.coverArt, 48)}
                  alt=""
                  className="orbit-guest-queue__cover"
                />
              ) : (
                <div className="orbit-guest-queue__cover orbit-guest-queue__cover--ph" />
              )}
              <div className="orbit-guest-queue__info">
                <div className="orbit-guest-queue__track-title">
                  {song?.title ?? '…'}
                </div>
                <div className="orbit-guest-queue__track-artist">
                  {song?.artist ?? ''}
                </div>
                <div className="orbit-guest-queue__submitter">
                  {t('orbit.guestSubmitter', { user: q.addedBy })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="orbit-guest-queue__footer">{t('orbit.guestFooter')}</div>
    </div>
  );
}
