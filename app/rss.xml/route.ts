import { getPhotosCached } from '@/photo/cache';
import { SITE_FEEDS_ENABLED } from '@/app/config';
import { formatFeedRssXml } from '@/feed/rss';
import { PROGRAMMATIC_QUERY_OPTIONS } from '@/feed';
import { FEED_PHOTO_MAX_LIMIT, FEED_PHOTO_REQUEST_LIMIT } from '@/feed/programmatic';
import { Buffer } from 'node:buffer';

// Cache for 24 hours
export const revalidate = 86_400;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

const decodeCursor = (cursor?: string): { createdAt: string, id: string } | null => {
  if (!cursor) return null;
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf8');
    return JSON.parse(json) as { createdAt: string, id: string };
  } catch (e) {
    return null;
  }
};

const encodeCursor = (createdAt: string, id: string) =>
  Buffer.from(JSON.stringify({ createdAt, id })).toString('base64');

export async function GET(req: Request) {
  if (!SITE_FEEDS_ENABLED) {
    return new Response('Feeds disabled', { status: 404 });
  }

  const url = new URL(req.url);
  const limitParam = url.searchParams.get('limit');
  const offsetParam = url.searchParams.get('offset');
  const cursorParam = url.searchParams.get('cursor');

  const requestedLimit = limitParam ? parseInt(limitParam, 10) : undefined;
  const requestedOffset = offsetParam ? Math.max(0, parseInt(offsetParam, 10)) : undefined;

  const defaultLimit = FEED_PHOTO_REQUEST_LIMIT;
  const maxLimit = FEED_PHOTO_MAX_LIMIT;
  const limit = Math.max(
    1,
    Math.min(Number.isFinite(requestedLimit ?? NaN) ? requestedLimit! : defaultLimit, maxLimit),
  );

  const baseOptions = {
    ...PROGRAMMATIC_QUERY_OPTIONS,
    limit,
  } as any;

  const decodedCursor = decodeCursor(cursorParam ?? undefined);
  if (decodedCursor) {
    baseOptions.createdBefore = new Date(decodedCursor.createdAt);
    baseOptions.idBefore = decodedCursor.id;
  } else if (requestedOffset !== undefined) {
    baseOptions.offset = requestedOffset;
  }

  const photos = await getPhotosCached(baseOptions).catch(() => []);
  const xml = formatFeedRssXml(photos);

  let nextCursor: string | undefined;
  if (photos.length === limit && photos.length > 0) {
    const last = photos[photos.length - 1];
    const createdAtStr = (last.createdAt instanceof Date) ? last.createdAt.toISOString() : String(last.createdAt);
    nextCursor = encodeCursor(createdAtStr, last.id);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'text/xml',
    ...CORS_HEADERS,
  };
  if (nextCursor) { headers['X-Next-Cursor'] = nextCursor; }

  return new Response(xml, { headers });
}