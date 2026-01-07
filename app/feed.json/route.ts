import { getPhotosCached } from '@/photo/cache';
import { SITE_FEEDS_ENABLED } from '@/app/config';
import { formatFeedJson } from '@/feed/json';
import { PROGRAMMATIC_QUERY_OPTIONS } from '@/feed';
import { FEED_PHOTO_MAX_LIMIT, FEED_PHOTO_REQUEST_LIMIT } from '@/feed/programmatic';

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

export async function GET(req: Request) {
  if (!SITE_FEEDS_ENABLED) {
    return new Response('Feeds disabled', { status: 404 });
  }

  const url = new URL(req.url);
  const limitParam = url.searchParams.get('limit');
  const requested = limitParam ? parseInt(limitParam, 10) : undefined;

  const defaultLimit = FEED_PHOTO_REQUEST_LIMIT;
  const maxLimit = FEED_PHOTO_MAX_LIMIT;

  // Clamp and validate limit
  const limit = Math.max(
    1,
    Math.min(Number.isFinite(requested ?? NaN) ? requested! : defaultLimit, maxLimit),
  );

  const photos = await getPhotosCached({
    ...PROGRAMMATIC_QUERY_OPTIONS,
    limit,
  }).catch(() => []);

  const headers = {
    'Content-Type': 'application/json',
    ...CORS_HEADERS,
  };

  return new Response(JSON.stringify(formatFeedJson(photos)), { headers });
}