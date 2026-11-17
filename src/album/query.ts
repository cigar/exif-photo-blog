import { safelyQuery } from '@/db/query';
import { query, sql } from '@/platforms/postgres';
import { generateManyToManyValues } from '@/db';
import { Album, Albums, parseAlbumFromDb } from '.';

export const createAlbumsTable = () =>
  sql`
    CREATE TABLE IF NOT EXISTS albums (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      subhead TEXT,
      description TEXT,
      location JSONB,
      parent_album_id uuid REFERENCES albums(id) ON DELETE SET NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      cover_photo_id VARCHAR(8) REFERENCES photos(id) ON DELETE SET NULL,
      duration_days INTEGER,
      distance_km NUMERIC,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;

export const createAlbumPhotoTable = () =>
  sql`
    CREATE TABLE IF NOT EXISTS album_photo (
      album_id uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
      photo_id VARCHAR(8) NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
      sort_order SMALLINT NOT NULL DEFAULT 0,
      PRIMARY KEY (album_id, photo_id)
    )
  `;

export const insertAlbum = (album: Omit<Album, 'id'>) =>
  safelyQuery(() => sql`
    INSERT INTO albums (
      title,
      slug,
      subhead,
      description,
      location, parent_album_id, sort_order, cover_photo_id, duration_days, distance_km
    ) VALUES (
      ${album.title},
      ${album.slug},
      ${album.subhead},
      ${album.description},
      ${album.location
        ? JSON.stringify(album.location)
        : null},
      ${album.parentAlbumId ?? null}, ${album.sortOrder ?? 0},
      ${album.coverPhotoId ?? null}, ${album.durationDays ?? null}, ${album.distanceKm ?? null}
    )
    RETURNING id
  `.then(({ rows }) => rows[0]?.id as string)
  , 'insertAlbum');

export const updateAlbum = (album: Album) =>
  safelyQuery(() => sql`
    UPDATE albums SET
      title=${album.title},
      slug=${album.slug},
      subhead=${album.subhead},
      description=${album.description},
      location=${album.location
        ? JSON.stringify(album.location)
        : null},
      parent_album_id=${album.parentAlbumId ?? null},
      sort_order=${album.sortOrder ?? 0},
      cover_photo_id=${album.coverPhotoId ?? null},
      duration_days=${album.durationDays ?? null},
      distance_km=${album.distanceKm ?? null},
      updated_at=${(new Date()).toISOString()}
    WHERE id=${album.id}
  `, 'updateAlbum');

export const getAlbumFromSlug = (slug: string) =>
  safelyQuery(() => sql<Album>`
    SELECT * FROM albums WHERE slug=${slug}
  `.then(({ rows }) => rows[0] ? parseAlbumFromDb(rows[0]) : undefined)
  , 'getAlbumFromSlug');

export const getAlbumFromId = (id: string) =>
  safelyQuery(() => sql<Album>`
    SELECT * FROM albums WHERE id=${id}
  `.then(({ rows }) => rows[0] ? parseAlbumFromDb(rows[0]) : undefined)
  , 'getAlbumFromId');

export const albumHasChildren = (id: string) =>
  safelyQuery(() => sql`
    SELECT EXISTS(SELECT 1 FROM albums WHERE parent_album_id=${id}) AS has_children
  `.then(({ rows }) => Boolean(rows[0]?.has_children))
  , 'albumHasChildren');

export const getPublicAlbumSummary = (id: string) =>
  safelyQuery(() => sql`
    SELECT
      COUNT(DISTINCT p.id)::int AS photo_count,
      COUNT(DISTINCT ap.album_id) FILTER (WHERE p.id IS NOT NULL)::int AS non_empty_album_count
    FROM albums a
    LEFT JOIN albums child ON child.parent_album_id=a.id
    LEFT JOIN album_photo ap ON ap.album_id=COALESCE(child.id, a.id)
    LEFT JOIN photos p ON p.id=ap.photo_id
      AND p.hidden IS NOT TRUE AND p.exclude_from_feeds IS NOT TRUE
    WHERE a.id=${id}
  `.then(({ rows }) => ({
    photoCount: Number(rows[0]?.photo_count ?? 0),
    nonEmptyAlbumCount: Number(rows[0]?.non_empty_album_count ?? 0),
  }))
  , 'getPublicAlbumSummary');

export const ensureAlbumCollectionSchema = () =>
  safelyQuery(() => sql`SELECT parent_album_id FROM albums LIMIT 0`, 'ensureAlbumCollectionSchema');

export const deleteAlbum = (id: string) =>
  safelyQuery(() => sql`
    DELETE FROM albums WHERE id=${id}
  `, 'deleteAlbum');

export const getAlbumsWithMeta = () =>
  safelyQuery(() => sql`
    SELECT 
      a.*,
      COALESCE(COUNT(ap.photo_id), 0) as count
    FROM albums a
    LEFT JOIN album_photo ap ON a.id = ap.album_id
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `.then(({ rows }): Albums => rows.map(({
      count,
      ...album
    }) => ({
      album: parseAlbumFromDb(album),
      count: parseInt(count, 10),
      lastModified: album.updated_at as Date,
    })))
  , 'getAlbumsWithMeta');

export const clearPhotoAlbumIds = (photoId: string) =>
  safelyQuery(() => sql`
    DELETE FROM album_photo WHERE photo_id=${photoId}
  `, 'clearPhotoAlbumIds');

export const addPhotoAlbumIds = (photoIds: string[], albumIds: string[]) => {
  if (photoIds.length > 0 && albumIds.length > 0) {
    const {
      valueString,
      values,
    } = generateManyToManyValues(albumIds, photoIds);
    return safelyQuery(() => query(`
      INSERT INTO album_photo (album_id, photo_id)
      ${valueString}
      ON CONFLICT (album_id, photo_id) DO NOTHING
    `, values)
    , 'addPhotoAlbumIds');
  }
};

export const addPhotoAlbumId = (photoId: string, albumId: string) =>
  addPhotoAlbumIds([photoId], [albumId]);

export const getAlbumTitlesForPhoto = (photoId: string) =>
  safelyQuery(() => sql<{ title: string }>`
    SELECT a.title FROM albums a
    JOIN album_photo ap ON a.id = ap.album_id
    WHERE ap.photo_id=${photoId}
  `.then(({ rows }) => rows.map(({ title }) => title))
  , 'getAlbumTitlesForPhoto');

export const getTagsForAlbum = (albumId: string) =>
  safelyQuery(() => sql`
    SELECT DISTINCT unnest(p.tags) as tag
    FROM photos p
    LEFT JOIN album_photo ap ON p.id = ap.photo_id
    WHERE album_id=${albumId}
  `.then(({ rows }) => rows.map(({ tag }) => tag))
  , 'getTagsForAlbum');
