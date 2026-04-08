import React, { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { getAlbumList, getAlbumsByGenre, SubsonicAlbum } from '../api/subsonic';
import AlbumCard from '../components/AlbumCard';
import GenreFilterBar from '../components/GenreFilterBar';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { filterAlbumsByMixRatings, getMixMinRatingsConfigFromAuth } from '../utils/mixRatingFilter';

const ALBUM_COUNT = 30;
/** Extra pool when mix rating filter is on so we can still fill the grid after filtering. */
const ALBUM_FETCH_OVERSHOOT = 100;
/** Cap genre-union size before rating prefetch (avoids hundreds of `getArtist` calls). */
const GENRE_UNION_PREFILTER_CAP = 250;

async function fetchByGenres(genres: string[]): Promise<SubsonicAlbum[]> {
  const results = await Promise.all(genres.map(g => getAlbumsByGenre(g, 500, 0)));
  const seen = new Set<string>();
  const union = results.flat().filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
  // Fisher-Yates shuffle
  for (let i = union.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [union[i], union[j]] = [union[j], union[i]];
  }
  const pool = union.slice(0, GENRE_UNION_PREFILTER_CAP);
  const filtered = await filterAlbumsByMixRatings(pool, getMixMinRatingsConfigFromAuth());
  return filtered.slice(0, ALBUM_COUNT);
}

export default function RandomAlbums() {
  const { t } = useTranslation();
  const musicLibraryFilterVersion = useAuthStore(s => s.musicLibraryFilterVersion);
  const mixMinRatingFilterEnabled = useAuthStore(s => s.mixMinRatingFilterEnabled);
  const mixMinRatingAlbum = useAuthStore(s => s.mixMinRatingAlbum);
  const mixMinRatingArtist = useAuthStore(s => s.mixMinRatingArtist);
  const [albums, setAlbums] = useState<SubsonicAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const loadingRef = useRef(false);
  const filtered = selectedGenres.length > 0;

  const load = useCallback(async (genres: string[]) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const mixCfg = getMixMinRatingsConfigFromAuth();
      const albumMixActive =
        mixCfg.enabled && (mixCfg.minAlbum > 0 || mixCfg.minArtist > 0);
      const randomSize = albumMixActive ? Math.max(ALBUM_COUNT * 3, ALBUM_FETCH_OVERSHOOT) : ALBUM_COUNT;
      const data = genres.length > 0
        ? await fetchByGenres(genres)
        : (await filterAlbumsByMixRatings(await getAlbumList('random', randomSize), mixCfg)).slice(0, ALBUM_COUNT);
      setAlbums(data);
    } catch (e) {
      console.error(e);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [
    musicLibraryFilterVersion,
    mixMinRatingFilterEnabled,
    mixMinRatingAlbum,
    mixMinRatingArtist,
  ]);

  useEffect(() => { load(selectedGenres); }, [selectedGenres, load]);

  return (
    <div className="content-body animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>{t('randomAlbums.title')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <GenreFilterBar selected={selectedGenres} onSelectionChange={setSelectedGenres} />
          <button
            className="btn btn-ghost"
            onClick={() => load(selectedGenres)}
            disabled={loading}
            data-tooltip={t('randomAlbums.refresh')}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t('randomAlbums.refresh')}
          </button>
        </div>
      </div>

      {loading && albums.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="album-grid-wrap">
          {albums.map(a => <AlbumCard key={a.id} album={a} />)}
        </div>
      )}
    </div>
  );
}
