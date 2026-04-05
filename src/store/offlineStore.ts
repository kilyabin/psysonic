import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { buildStreamUrl, getArtist, getAlbum } from '../api/subsonic';
import type { SubsonicSong } from '../api/subsonic';
import { useAuthStore } from './authStore';
import { showToast } from '../utils/toast';

export interface OfflineTrackMeta {
  id: string;
  serverId: string;
  localPath: string;
  title: string;
  artist: string;
  album: string;
  albumId: string;
  artistId?: string;
  suffix: string;
  duration: number;
  bitRate?: number;
  coverArt?: string;
  year?: number;
  genre?: string;
  replayGainTrackDb?: number;
  replayGainAlbumDb?: number;
  replayGainPeak?: number;
  cachedAt: string;
}

export interface OfflineAlbumMeta {
  id: string;
  serverId: string;
  name: string;
  artist: string;
  coverArt?: string;
  year?: number;
  trackIds: string[];
  type?: 'album' | 'playlist' | 'artist';
}

export interface DownloadJob {
  trackId: string;
  albumId: string;
  albumName: string;
  trackTitle: string;
  trackIndex: number;
  totalTracks: number;
  status: 'queued' | 'downloading' | 'done' | 'error';
}

interface OfflineState {
  tracks: Record<string, OfflineTrackMeta>;   // key: `${serverId}:${trackId}`
  albums: Record<string, OfflineAlbumMeta>;   // key: `${serverId}:${albumId}`
  jobs: DownloadJob[];
  /** Progress for bulk (playlist / artist) downloads. Key = playlistId or artistId. */
  bulkProgress: Record<string, { done: number; total: number }>;

  isDownloaded: (trackId: string, serverId: string) => boolean;
  isAlbumDownloaded: (albumId: string, serverId: string) => boolean;
  isAlbumDownloading: (albumId: string) => boolean;
  getLocalUrl: (trackId: string, serverId: string) => string | null;
  downloadAlbum: (
    albumId: string,
    albumName: string,
    albumArtist: string,
    coverArt: string | undefined,
    year: number | undefined,
    songs: SubsonicSong[],
    serverId: string,
    type?: 'album' | 'playlist' | 'artist',
  ) => Promise<void>;
  downloadPlaylist: (playlistId: string, playlistName: string, coverArt: string | undefined, songs: SubsonicSong[], serverId: string) => Promise<void>;
  downloadArtist: (artistId: string, artistName: string, serverId: string) => Promise<void>;
  deleteAlbum: (albumId: string, serverId: string) => Promise<void>;
  clearAll: (serverId: string) => Promise<void>;
  getAlbumProgress: (albumId: string) => { done: number; total: number } | null;
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      tracks: {},
      albums: {},
      jobs: [],
      bulkProgress: {},

      isDownloaded: (trackId, serverId) =>
        !!get().tracks[`${serverId}:${trackId}`],

      isAlbumDownloaded: (albumId, serverId) => {
        const album = get().albums[`${serverId}:${albumId}`];
        if (!album || album.trackIds.length === 0) return false;
        return album.trackIds.every(tid => !!get().tracks[`${serverId}:${tid}`]);
      },

      isAlbumDownloading: (albumId) =>
        get().jobs.some(
          j => j.albumId === albumId && (j.status === 'queued' || j.status === 'downloading')
        ),

      getLocalUrl: (trackId, serverId) => {
        const meta = get().tracks[`${serverId}:${trackId}`];
        if (!meta) return null;
        return `psysonic-local://${meta.localPath}`;
      },

      clearAll: async (serverId) => {
        const albumKeys = Object.keys(get().albums).filter(k => k.startsWith(`${serverId}:`));
        for (const key of albumKeys) {
          const albumId = key.slice(`${serverId}:`.length);
          await get().deleteAlbum(albumId, serverId);
        }
      },

      getAlbumProgress: (albumId) => {
        const albumJobs = get().jobs.filter(j => j.albumId === albumId);
        if (albumJobs.length === 0) return null;
        const done = albumJobs.filter(j => j.status === 'done' || j.status === 'error').length;
        return { done, total: albumJobs.length };
      },

      downloadAlbum: async (albumId, albumName, albumArtist, coverArt, year, songs, serverId, type = 'album') => {
        const CONCURRENCY = 2;
        const trackIds = songs.map(s => s.id);

        // Register album shell + queue jobs
        set(state => ({
          albums: {
            ...state.albums,
            [`${serverId}:${albumId}`]: { id: albumId, serverId, name: albumName, artist: albumArtist, coverArt, year, trackIds, type },
          },
          jobs: [
            ...state.jobs.filter(j => j.albumId !== albumId),
            ...songs.map((s, i) => ({
              trackId: s.id,
              albumId,
              albumName,
              trackTitle: s.title,
              trackIndex: i,
              totalTracks: songs.length,
              status: 'queued' as const,
            })),
          ],
        }));

        // Download in batches of CONCURRENCY
        for (let i = 0; i < songs.length; i += CONCURRENCY) {
          const batch = songs.slice(i, i + CONCURRENCY);
          await Promise.all(
            batch.map(async song => {
              set(state => ({
                jobs: state.jobs.map(j =>
                  j.trackId === song.id && j.albumId === albumId
                    ? { ...j, status: 'downloading' }
                    : j,
                ),
              }));

              const suffix = song.suffix || 'mp3';
              const url = buildStreamUrl(song.id);
              const customDir = useAuthStore.getState().offlineDownloadDir || null;

              try {
                const localPath = await invoke<string>('download_track_offline', {
                  trackId: song.id,
                  serverId,
                  url,
                  suffix,
                  customDir,
                });

                set(state => ({
                  tracks: {
                    ...state.tracks,
                    [`${serverId}:${song.id}`]: {
                      id: song.id,
                      serverId,
                      localPath,
                      title: song.title,
                      artist: song.artist,
                      album: song.album,
                      albumId: song.albumId,
                      artistId: song.artistId,
                      suffix,
                      duration: song.duration,
                      bitRate: song.bitRate,
                      coverArt: song.coverArt,
                      year: song.year,
                      genre: song.genre,
                      replayGainTrackDb: song.replayGain?.trackGain,
                      replayGainAlbumDb: song.replayGain?.albumGain,
                      replayGainPeak: song.replayGain?.trackPeak,
                      cachedAt: new Date().toISOString(),
                    },
                  },
                  jobs: state.jobs.map(j =>
                    j.trackId === song.id && j.albumId === albumId
                      ? { ...j, status: 'done' }
                      : j,
                  ),
                }));
              } catch (err) {
                const msg = typeof err === 'string' ? err : (err instanceof Error ? err.message : '');
                if (msg === 'VOLUME_NOT_FOUND') {
                  showToast('Speichermedium nicht gefunden. Bitte Verzeichnis in den Einstellungen prüfen.', 6000, 'error');
                }
                set(state => ({
                  jobs: state.jobs.map(j =>
                    j.trackId === song.id && j.albumId === albumId
                      ? { ...j, status: 'error' }
                      : j,
                  ),
                }));
              }
            }),
          );
        }

        // Clear completed jobs after a short delay
        setTimeout(() => {
          set(state => ({
            jobs: state.jobs.filter(
              j => j.albumId !== albumId || (j.status !== 'done' && j.status !== 'error'),
            ),
          }));
        }, 2500);
      },

      downloadPlaylist: async (playlistId, playlistName, coverArt, songs, serverId) => {
        // Deduplicate songs (a track can appear multiple times in a playlist).
        const seen = new Set<string>();
        const unique = songs.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });
        // Store the entire playlist as one virtual album entry so the Offline Library
        // shows a single card for the playlist rather than one card per album.
        await get().downloadAlbum(playlistId, playlistName, '', coverArt, undefined, unique, serverId, 'playlist');
      },

      downloadArtist: async (artistId, artistName, serverId) => {
        let albums: { id: string; name: string; artist: string; coverArt?: string; year?: number }[] = [];
        try {
          const res = await getArtist(artistId);
          albums = res.albums;
        } catch { return; }
        set(state => ({
          bulkProgress: { ...state.bulkProgress, [artistId]: { done: 0, total: albums.length } },
        }));
        for (let i = 0; i < albums.length; i++) {
          const album = albums[i];
          try {
            const { songs } = await getAlbum(album.id);
            await get().downloadAlbum(album.id, album.name, album.artist || artistName, album.coverArt, album.year, songs, serverId, 'artist');
          } catch { /* skip failed album */ }
          set(state => ({
            bulkProgress: { ...state.bulkProgress, [artistId]: { done: i + 1, total: albums.length } },
          }));
        }
        setTimeout(() => {
          set(state => {
            const { [artistId]: _removed, ...rest } = state.bulkProgress;
            return { bulkProgress: rest };
          });
        }, 3000);
      },

      deleteAlbum: async (albumId, serverId) => {
        const album = get().albums[`${serverId}:${albumId}`];
        if (!album) return;

        await Promise.all(
          album.trackIds.map(async trackId => {
            const meta = get().tracks[`${serverId}:${trackId}`];
            if (!meta) return;
            await invoke('delete_offline_track', {
              localPath: meta.localPath,
              baseDir: useAuthStore.getState().offlineDownloadDir || null,
            }).catch(() => {});
          }),
        );

        set(state => {
          const tracks = { ...state.tracks };
          album.trackIds.forEach(tid => delete tracks[`${serverId}:${tid}`]);
          const albums = { ...state.albums };
          delete albums[`${serverId}:${albumId}`];
          return { tracks, albums };
        });
      },
    }),
    {
      name: 'psysonic-offline',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({ tracks: state.tracks, albums: state.albums }),
    },
  ),
);
