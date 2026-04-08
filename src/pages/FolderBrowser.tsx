import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getMusicFolders, getMusicDirectory, getMusicIndexes, SubsonicDirectoryEntry } from '../api/subsonic';
import { usePlayerStore, Track } from '../store/playerStore';
import { useTranslation } from 'react-i18next';
import { Folder, FolderOpen, Music, ChevronRight } from 'lucide-react';

// ── types ─────────────────────────────────────────────────────────────────────

type Column = {
  id: string;
  name: string;
  items: SubsonicDirectoryEntry[];
  selectedId: string | null;
  loading: boolean;
  error: boolean;
};

// ── helpers ───────────────────────────────────────────────────────────────────

function entryToTrack(e: SubsonicDirectoryEntry): Track {
  return {
    id: e.id,
    title: e.title,
    artist: e.artist ?? '',
    album: e.album ?? '',
    albumId: e.albumId ?? '',
    artistId: e.artistId,
    coverArt: e.coverArt,
    duration: e.duration ?? 0,
    track: e.track,
    year: e.year,
    bitRate: e.bitRate,
    suffix: e.suffix,
    genre: e.genre,
    starred: e.starred,
    userRating: e.userRating,
  };
}

// ── component ─────────────────────────────────────────────────────────────────

export default function FolderBrowser() {
  const { t } = useTranslation();
  const [columns, setColumns] = useState<Column[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playTrack = usePlayerStore(s => s.playTrack);

  // ── root: load music folders on mount ─────────────────────────────────────
  useEffect(() => {
    const placeholder: Column = { id: 'root', name: '', items: [], selectedId: null, loading: true, error: false };
    setColumns([placeholder]);
    getMusicFolders()
      .then(folders => {
        const items: SubsonicDirectoryEntry[] = folders.map(f => ({
          id: f.id,
          title: f.name,
          isDir: true,
        }));
        setColumns([{ ...placeholder, items, loading: false }]);
      })
      .catch(() => {
        setColumns([{ ...placeholder, items: [], loading: false, error: true }]);
      });
  }, []);

  // ── auto-scroll to newly added column ─────────────────────────────────────
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    requestAnimationFrame(() => { el.scrollLeft = el.scrollWidth; });
  }, [columns.length]);

  // ── click a directory ──────────────────────────────────────────────────────
  const handleDirClick = useCallback((colIndex: number, item: SubsonicDirectoryEntry) => {
    // Mark selected + truncate columns after this one + add loading column
    setColumns(prev => [
      ...prev.slice(0, colIndex + 1).map((c, i) =>
        i === colIndex ? { ...c, selectedId: item.id } : c,
      ),
      { id: item.id, name: item.title, items: [], selectedId: null, loading: true, error: false },
    ]);

    // Column 0 holds music folder roots — their IDs are only valid for
    // getIndexes.view (musicFolderId), not getMusicDirectory.view
    const fetchItems = colIndex === 0
      ? getMusicIndexes(item.id)
      : getMusicDirectory(item.id).then(d => d.child);

    fetchItems
      .then(items => {
        setColumns(prev => {
          const idx = prev.findIndex(c => c.id === item.id && c.loading);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], items, loading: false };
          return next;
        });
      })
      .catch(() => {
        setColumns(prev => {
          const idx = prev.findIndex(c => c.id === item.id && c.loading);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = { ...next[idx], loading: false, error: true };
          return next;
        });
      });
  }, []);

  // ── click a file (track) ───────────────────────────────────────────────────
  const handleFileClick = useCallback((colIndex: number, item: SubsonicDirectoryEntry) => {
    setColumns(prev => prev.map((c, i) =>
      i === colIndex ? { ...c, selectedId: item.id } : c,
    ));
    // Build queue from all tracks in this column
    const col = columns[colIndex];
    const queue = col.items.filter(it => !it.isDir).map(entryToTrack);
    playTrack(entryToTrack(item), queue.length > 0 ? queue : [entryToTrack(item)]);
  }, [columns, playTrack]);

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="folder-browser">
      <h1 className="page-title folder-browser-title">{t('sidebar.folderBrowser')}</h1>
      <div className="folder-browser-columns" ref={wrapperRef}>
        {columns.map((col, colIndex) => (
          <div key={`${col.id}-${colIndex}`} className="folder-col">
            {col.loading ? (
              <div className="folder-col-status">
                <div className="spinner" style={{ width: 20, height: 20 }} />
              </div>
            ) : col.error ? (
              <div className="folder-col-status folder-col-error">
                {t('folderBrowser.error')}
              </div>
            ) : col.items.length === 0 ? (
              <div className="folder-col-status">{t('folderBrowser.empty')}</div>
            ) : (
              col.items.map(item => {
                const isSelected = col.selectedId === item.id;
                return (
                  <button
                    key={item.id}
                    className={`folder-col-row${isSelected ? ' selected' : ''}`}
                    onClick={() =>
                      item.isDir
                        ? handleDirClick(colIndex, item)
                        : handleFileClick(colIndex, item)
                    }
                  >
                    <span className="folder-col-icon">
                      {item.isDir
                        ? isSelected
                          ? <FolderOpen size={14} />
                          : <Folder size={14} />
                        : <Music size={14} />}
                    </span>
                    <span className="folder-col-name">{item.title}</span>
                    {item.isDir && (
                      <ChevronRight size={12} className="folder-col-chevron" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
