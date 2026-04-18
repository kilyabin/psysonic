import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen, emitTo } from '@tauri-apps/api/event';
import { usePlayerStore } from '../store/playerStore';

export const MINI_WINDOW_LABEL = 'mini';

export interface MiniTrackInfo {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumId?: string;
  artistId?: string;
  coverArt?: string;
  duration?: number;
  starred?: boolean;
}

export interface MiniSyncPayload {
  track: MiniTrackInfo | null;
  queue: MiniTrackInfo[];
  queueIndex: number;
  isPlaying: boolean;
  isMobile: false;
}

export type MiniControlAction =
  | 'toggle'
  | 'next'
  | 'prev'
  | 'show-main';

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

function snapshot(): MiniSyncPayload {
  const s = usePlayerStore.getState();
  return {
    track: s.currentTrack ? toMini(s.currentTrack) : null,
    queue: (s.queue ?? []).map(toMini),
    queueIndex: s.queueIndex ?? 0,
    isPlaying: s.isPlaying,
    isMobile: false,
  };
}

/**
 * Bridge initialised on the main window. Pushes track/state changes to the
 * mini window whenever they matter, and handles control events coming back
 * from the mini window.
 *
 * Returns a cleanup function.
 */
export function initMiniPlayerBridgeOnMain(): () => void {
  // Only run on the main window
  if (getCurrentWindow().label !== 'main') return () => {};

  // Push state to the mini window on every relevant store change.
  let last = '';
  const push = () => {
    const payload = snapshot();
    const queueIds = payload.queue.map(q => q.id).join(',');
    const key = `${payload.track?.id ?? ''}|${payload.isPlaying}|${payload.track?.starred ?? ''}|${payload.queueIndex}|${queueIds}`;
    if (key === last) return;
    last = key;
    emitTo(MINI_WINDOW_LABEL, 'mini:sync', payload).catch(() => {});
  };

  const unsub = usePlayerStore.subscribe((state, prev) => {
    if (state.currentTrack?.id !== prev.currentTrack?.id
      || state.isPlaying !== prev.isPlaying
      || state.currentTrack?.starred !== prev.currentTrack?.starred
      || state.queueIndex !== prev.queueIndex
      || state.queue !== prev.queue) {
      push();
    }
  });

  // Push an initial snapshot whenever a new mini window announces itself.
  const readyUnlisten = listen('mini:ready', () => {
    last = '';
    push();
  });

  // Receive control actions from the mini window.
  const controlUnlisten = listen<MiniControlAction>('mini:control', (e) => {
    const action = e.payload;
    const store = usePlayerStore.getState();
    switch (action) {
      case 'toggle':   store.togglePlay(); break;
      case 'next':     store.next(true); break;
      case 'prev':     store.previous(); break;
      case 'show-main': {
        const w = getCurrentWindow();
        w.unminimize().catch(() => {});
        w.show().catch(() => {});
        w.setFocus().catch(() => {});
        break;
      }
    }
  });

  // Jump to a specific queue index.
  const jumpUnlisten = listen<{ index: number }>('mini:jump', (e) => {
    const store = usePlayerStore.getState();
    const idx = e.payload?.index ?? -1;
    if (idx < 0 || idx >= store.queue.length) return;
    const track = store.queue[idx];
    if (track) store.playTrack(track, store.queue, true);
  });

  return () => {
    unsub();
    readyUnlisten.then(fn => fn()).catch(() => {});
    controlUnlisten.then(fn => fn()).catch(() => {});
    jumpUnlisten.then(fn => fn()).catch(() => {});
  };
}
