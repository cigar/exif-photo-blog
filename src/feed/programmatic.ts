import { descriptionForPhoto, Photo, titleForPhoto } from '@/photo';
import { getOptimizedPhotoUrl } from '@/photo/storage';
import { NextImageSize } from '@/platforms/next-image';

// Default limit can be overridden with env FEED_PHOTO_REQUEST_LIMIT
// and the maximum allowed value can be controlled with FEED_PHOTO_MAX_LIMIT.
export const FEED_PHOTO_REQUEST_LIMIT = parseInt(
  process.env.FEED_PHOTO_REQUEST_LIMIT ?? '40',
  10,
);
export const FEED_PHOTO_MAX_LIMIT = parseInt(
  process.env.FEED_PHOTO_MAX_LIMIT ?? '200',
  10,
);

export const FEED_PHOTO_WIDTH_SMALL = 200;
export const FEED_PHOTO_WIDTH_MEDIUM = 640;
// Match the persisted `-lg` variant created when each photo is uploaded.
export const FEED_PHOTO_WIDTH_LARGE = 1080;

export interface FeedMedia {
  url: string
  width: number
  height: number
}

export const generateFeedMedia = (
  photo: Photo,
  size: NextImageSize,
): FeedMedia => {
  const url = getOptimizedPhotoUrl({
    imageUrl: photo.url,
    size,
    useNextImage: false,
  });
  const cacheBustedUrl = new URL(url);
  cacheBustedUrl.searchParams.set(
    'v',
    String(new Date(photo.updatedAt).getTime()),
  );
  return {
  // Feed consumers need stable, already-generated files. Sending these URLs
  // directly avoids a new Vercel Image Optimization transformation per size.
    url: cacheBustedUrl.toString(),
  width: size,
  height: Math.round(size / photo.aspectRatio),
  };
};

export const getCoreFeedFields = (photo: Photo) => ({
  id: photo.id,
  title: titleForPhoto(photo),
  description: descriptionForPhoto(photo, true),
});
