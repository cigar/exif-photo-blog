'use client';

import { useCallback, useState } from 'react';
import { getPublicAlbumCoverChoicesAction } from './actions';

type PhotoChoice = { id: string; title: string; takenAt: string };

export default function AlbumCoverPhotoSelect({
  albumId,
  value,
  onChange,
}: {
  albumId: string
  value?: string | null
  onChange: (value: string | null) => void
}) {
  const [photos, setPhotos] = useState<PhotoChoice[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadMore = useCallback(async () => {
    if (!albumId || isLoading || (hasLoaded && photos.length >= total)) return;
    setIsLoading(true);
    try {
      const result = await getPublicAlbumCoverChoicesAction(albumId, photos.length);
      const allLoadedPhotos = [...photos, ...result.photos];
      setPhotos(allLoadedPhotos);
      setTotal(result.total);
      setHasLoaded(true);
      if (
        value &&
        allLoadedPhotos.length >= result.total &&
        !allLoadedPhotos.some(photo => photo.id === value)
      ) onChange(null);
    } finally {
      setIsLoading(false);
    }
  }, [albumId, hasLoaded, isLoading, onChange, photos, total, value]);

  if (!albumId) {
    return <p className="text-sm text-dim">Save the album and add photos to choose a cover.</p>;
  }

  return (
    <div className="space-y-2">
      <label htmlFor="coverPhotoId" className="block text-sm font-medium">
        Cover photo
      </label>
      <select
        id="coverPhotoId"
        name="coverPhotoId"
        className="w-full"
        value={value ?? ''}
        onChange={event => onChange(event.target.value || null)}
      >
        <option value="">Choose first public photo automatically</option>
        {value && !hasLoaded && !photos.some(photo => photo.id === value) &&
          <option value={value}>Current cover: {value}</option>}
        {photos.map(photo => (
          <option key={photo.id} value={photo.id}>
            {photo.title || photo.id} · {new Date(photo.takenAt).toLocaleDateString()}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-3 text-xs text-dim">
        <span>{hasLoaded
          ? `${total} public photos available`
          : 'Load public photos to choose a cover'}</span>
        {!hasLoaded && <button
          type="button"
          className="link"
          onClick={() => void loadMore()}
          disabled={isLoading}
        >
          {isLoading ? 'Loading…' : 'Load public photos'}
        </button>}
        {hasLoaded && photos.length < total && <button
          type="button"
          className="link"
          onClick={() => void loadMore()}
          disabled={isLoading}
        >
          {isLoading ? 'Loading…' : 'Load more photos'}
        </button>}
      </div>
      {value && !photos.some(photo => photo.id === value) && hasLoaded &&
        <p className="text-sm text-red-600">The saved cover is no longer public in this album.</p>}
    </div>
  );
}
