import React, { useEffect, useRef, useState } from 'react';
import { getCachedUrl } from '../utils/imageCache';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  cacheKey: string;
}

/**
 * @param fallbackToFetch  If true (default), returns the raw fetchUrl while the
 *   blob is still resolving — useful for <img> tags so the browser starts
 *   loading immediately.  Pass false for CSS background-image consumers that
 *   should only see a stable blob URL (prevents a double crossfade).
 */
export function useCachedUrl(fetchUrl: string, cacheKey: string, fallbackToFetch = true): string {
  const [resolved, setResolved] = useState('');
  useEffect(() => {
    if (!fetchUrl) { setResolved(''); return; }
    const controller = new AbortController();
    setResolved('');
    getCachedUrl(fetchUrl, cacheKey, controller.signal).then(url => {
      if (!controller.signal.aborted) setResolved(url);
    });
    return () => { controller.abort(); };
  }, [fetchUrl, cacheKey]);
  return fallbackToFetch ? (resolved || fetchUrl) : resolved;
}

export default function CachedImage({ src, cacheKey, style, onLoad, ...props }: CachedImageProps) {
  const [inView, setInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { rootMargin: '300px' }, // start fetching 300px before entering viewport
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Pass empty string when not yet in view so useCachedUrl skips the fetch entirely.
  const resolvedSrc = useCachedUrl(inView ? src : '', cacheKey);
  const [loaded, setLoaded] = useState(false);

  // Reset only when the logical image changes (cacheKey), not on fetchUrl→blobUrl
  // URL upgrades within the same image — avoids the end-of-load flash.
  useEffect(() => {
    setLoaded(false);
  }, [cacheKey]);

  return (
    <img
      ref={imgRef}
      src={resolvedSrc || undefined}
      style={{ ...style, opacity: loaded ? 1 : 0, transition: 'opacity 0.15s ease' }}
      onLoad={e => { setLoaded(true); onLoad?.(e); }}
      {...props}
    />
  );
}
