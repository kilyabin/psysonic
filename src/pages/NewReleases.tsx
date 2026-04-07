import React, { useEffect, useState, useCallback, useRef } from 'react';
import AlbumCard from '../components/AlbumCard';
import GenreFilterBar from '../components/GenreFilterBar';
import { getAlbumList, getAlbumsByGenre, SubsonicAlbum } from '../api/subsonic';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';

const PAGE_SIZE = 30;

async function fetchByGenres(genres: string[]): Promise<SubsonicAlbum[]> {
  const results = await Promise.all(genres.map(g => getAlbumsByGenre(g, 500, 0)));
  const seen = new Set<string>();
  const union = results.flat().filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
  return union.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}

export default function NewReleases() {
  const { t } = useTranslation();
  const musicLibraryFilterVersion = useAuthStore(s => s.musicLibraryFilterVersion);
  const [albums, setAlbums] = useState<SubsonicAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const observerTarget = useRef<HTMLDivElement>(null);
  const filtered = selectedGenres.length > 0;

  const load = useCallback(async (offset: number, append = false) => {
    setLoading(true);
    try {
      const data = await getAlbumList('newest', PAGE_SIZE, offset);
      if (append) setAlbums(prev => [...prev, ...data]);
      else setAlbums(data);
      setHasMore(data.length === PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFiltered = useCallback(async (genres: string[]) => {
    setLoading(true);
    try {
      setAlbums(await fetchByGenres(genres));
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [musicLibraryFilterVersion]);

  useEffect(() => {
    if (filtered) loadFiltered(selectedGenres);
    else { setPage(0); load(0); }
  }, [filtered, selectedGenres, load, loadFiltered]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore || filtered) return;
    const next = page + 1;
    setPage(next);
    load(next * PAGE_SIZE, true);
  }, [loading, hasMore, page, load, filtered]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: '200px' }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="content-body animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>{t('sidebar.newReleases')}</h1>
        <GenreFilterBar selected={selectedGenres} onSelectionChange={setSelectedGenres} />
      </div>

      {loading && albums.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          <div className="album-grid-wrap">
            {albums.map(a => <AlbumCard key={a.id} album={a} />)}
          </div>
          {!filtered && (
            <div ref={observerTarget} style={{ height: '20px', margin: '2rem 0', display: 'flex', justifyContent: 'center' }}>
              {loading && hasMore && <div className="spinner" style={{ width: 20, height: 20 }} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
