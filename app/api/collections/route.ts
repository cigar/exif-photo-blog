import { SITE_FEEDS_ENABLED } from '@/app/config';
import { sql } from '@/platforms/postgres';
import { getPhotosCached } from '@/photo/cache';
import { generateFeedMedia, FEED_PHOTO_WIDTH_SMALL, FEED_PHOTO_WIDTH_MEDIUM, FEED_PHOTO_WIDTH_LARGE } from '@/feed/programmatic';
import { PROGRAMMATIC_QUERY_OPTIONS } from '@/feed';
import { absolutePathForPhoto, absolutePathForAlbum } from '@/app/path';
import { convertOklchToCss } from '@/photo/color/client';
import { ensureAlbumCollectionSchema } from '@/album/query';

export const revalidate = 300;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

const encodeCursor = (offset: number) => Buffer.from(JSON.stringify({ offset })).toString('base64url');
const decodeCursor = (cursor: string) => {
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    return Number.isInteger(value.offset) && value.offset >= 0 ? value.offset as number : null;
  } catch { return null; }
};

const photoCover = (photo: any) => ({
  id: photo.id,
  title: photo.title,
  url: absolutePathForPhoto({ photo }),
  src: {
    small: generateFeedMedia(photo, FEED_PHOTO_WIDTH_SMALL),
    medium: generateFeedMedia(photo, FEED_PHOTO_WIDTH_MEDIUM),
    large: generateFeedMedia(photo, FEED_PHOTO_WIDTH_LARGE),
  },
  aspectRatio: photo.aspectRatio,
  ...(photo.colorData?.average && { dominantColor: convertOklchToCss(photo.colorData.average) }),
});

const coverFor = async (album: any) => {
  const options = { ...PROGRAMMATIC_QUERY_OPTIONS, album, albumSortOrder: true, limit: 1 };
  const specified = album.coverPhotoId
    ? await getPhotosCached({ ...options, photoIds: [album.coverPhotoId] }).catch(() => [])
    : [];
  const photo = specified[0] ?? (await getPhotosCached(options).catch(() => []))[0];
  return photo ? photoCover(photo) : null;
};

export async function GET(request: Request) {
  if (!SITE_FEEDS_ENABLED) return Response.json({ error: 'Feeds disabled' }, { status: 404, headers: CORS_HEADERS });
  const url = new URL(request.url);
  const requested = Number.parseInt(url.searchParams.get('limit') ?? '100', 10);
  const limit = Math.max(1, Math.min(Number.isFinite(requested) ? requested : 100, 200));
  const cursor = url.searchParams.get('cursor');
  const offset = cursor ? decodeCursor(cursor) : 0;
  if (offset === null) return Response.json({ error: 'Malformed cursor' }, { status: 400, headers: CORS_HEADERS });
  await ensureAlbumCollectionSchema();

  const { rows } = await sql<any>`
    SELECT a.*, count(DISTINCT p.id)::int AS photo_count,
      MIN(p.taken_at_naive) AS date_start, MAX(p.taken_at_naive) AS date_end
    FROM albums a
    LEFT JOIN albums child ON child.parent_album_id = a.id
    LEFT JOIN album_photo ap ON ap.album_id = COALESCE(child.id, a.id)
    LEFT JOIN photos p ON p.id = ap.photo_id AND p.hidden IS NOT TRUE AND p.exclude_from_feeds IS NOT TRUE
    WHERE a.parent_album_id IS NULL
    GROUP BY a.id
    ORDER BY a.sort_order ASC, a.title ASC, a.slug ASC
  `;
  const publicAlbums = rows.filter(row => Number(row.photo_count) > 0);
  const collections = [];
  for (const parent of publicAlbums.slice(offset, offset + limit)) {
    const { rows: childRows } = await sql<any>`
      SELECT c.*, COUNT(DISTINCT p.id)::int AS photo_count,
        MIN(p.taken_at_naive) AS date_start, MAX(p.taken_at_naive) AS date_end
      FROM albums c
      JOIN album_photo ap ON ap.album_id = c.id
      JOIN photos p ON p.id = ap.photo_id AND p.hidden IS NOT TRUE AND p.exclude_from_feeds IS NOT TRUE
      WHERE c.parent_album_id=${parent.id}
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.title ASC, c.slug ASC
    `;
    const children = await Promise.all(childRows.map(async child => {
      const album = { ...child, id: child.id, coverPhotoId: child.cover_photo_id };
      const cover = await coverFor(album);
      return {
        id: child.id, slug: child.slug, title: child.title, subhead: child.subhead,
        description: child.description, location: child.location, photoCount: Number(child.photo_count),
        sortOrder: Number(child.sort_order), url: absolutePathForAlbum(child.slug),
        dateRange: child.date_start && child.date_end ? { start: String(child.date_start).slice(0, 10), end: String(child.date_end).slice(0, 10) } : null,
        cover,
      };
    }));
    // A parent is a container; its count and dates come from the union of child photos.
    const childIds = childRows.map(child => child.id);
    const { rows: aggregateRows } = childIds.length ? await sql<any>`
      SELECT COUNT(DISTINCT p.id)::int AS photo_count,
        MIN(p.taken_at_naive) AS date_start, MAX(p.taken_at_naive) AS date_end
      FROM album_photo ap JOIN photos p ON p.id=ap.photo_id
      WHERE ap.album_id = ANY(${`{${childIds.join(',')}}`}::uuid[])
        AND p.hidden IS NOT TRUE AND p.exclude_from_feeds IS NOT TRUE
    ` : { rows: [] };
    const aggregate = aggregateRows[0] ?? parent;
    const firstChild = children[0];
    collections.push({
      id: parent.id, slug: parent.slug, title: parent.title, subhead: parent.subhead,
      description: parent.description, location: parent.location,
      photoCount: Number(aggregate.photo_count), durationDays: parent.duration_days,
      distanceKm: parent.distance_km === null ? null : Number(parent.distance_km), sortOrder: Number(parent.sort_order),
      dateRange: aggregate.date_start && aggregate.date_end ? { start: String(aggregate.date_start).slice(0, 10), end: String(aggregate.date_end).slice(0, 10) } : null,
      cover: firstChild?.cover ?? await coverFor({ ...parent, coverPhotoId: parent.cover_photo_id }), albums: children,
    });
  }
  const hasMore = publicAlbums.length > offset + limit;
  const body = { meta: { total: publicAlbums.length, hasMore, nextCursor: hasMore ? encodeCursor(offset + limit) : null }, collections };
  const etag = `"collections-${publicAlbums.length}-${rows.reduce((v, row) => Math.max(v, new Date(row.updated_at).getTime()), 0)}"`;
  return Response.json(body, { headers: { ...CORS_HEADERS, 'Cache-Control': 'public, max-age=300', ETag: etag } });
}
