import { getUniqueTagsCached } from '@/photo/cache';
import { SITE_FEEDS_ENABLED } from '@/app/config';

// Cache for 1 hour
export const revalidate = 3600;

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new Response(null, { headers: CORS_HEADERS });
}

export async function GET() {
    if (!SITE_FEEDS_ENABLED) {
        return new Response('Feeds disabled', { status: 404 });
    }

    const uniqueTags = await getUniqueTagsCached().catch(() => []);

    // Transform to match API response format
    const tags = uniqueTags.map(({ tag, count }) => ({
        name: tag,
        count,
    }));

    // Generate ETag from tag data
    const etag = `"tags-${tags.length}-${Date.now()}"`;

    const headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        'ETag': etag,
        ...CORS_HEADERS,
    };

    return new Response(JSON.stringify({ tags }), { headers });
}
