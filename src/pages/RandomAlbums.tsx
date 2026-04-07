import React, { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { getAlbumList, getAlbumsByGenre, SubsonicAlbum } from '../api/subsonic';
import AlbumCard from '../components/AlbumCard';
import GenreFilterBar from '../components/GenreFilterBar';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';

const ALBUM_COUNT = 30;

async function fetchByGenres(genres: string[]): Promise<SubsonicAlbum[]> {
  const results = await Promise.all(genres.map(g => getAlbumsByGenre(g, 500, 0)));
  const seen = new Set<string>();
  const union = results.flat().filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
  // Fisher-Yates shuffle
  for (let i = union.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [union[i], union[j]] = [union[j], union[i]];
  }
  return union.slice(0, ALBUM_COUNT);
}

export default function RandomAlbums() {
  const { t } = useTranslation();
  const musicLibraryFilterVersion = useAuthStore(s => s.musicLibraryFilterVersion);
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
      const data = genres.length > 0
        ? await fetchByGenres(genres)
        : await getAlbumList('random', ALBUM_COUNT);
      setAlbums(data);
    } catch (e) {
      console.error(e);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [musicLibraryFilterVersion]);

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
