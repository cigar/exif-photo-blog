'use server';

import { runAuthenticatedAdminServerAction } from '@/auth/server';
import {
  deleteAlbum,
  getAlbumFromSlug,
  getAlbumFromId,
  albumHasChildren,
  insertAlbum,
  updateAlbum,
} from './query';
import { revalidateAllKeysAndPaths } from '@/cache';
import { redirect } from 'next/navigation';
import { PATH_ROOT, pathForAlbum } from '@/app/path';
import { convertFormDataToAlbum } from './form';
import { Album } from '.';
import { getPhotosCached, getPhotosMetaCached } from '@/photo/cache';
import { titleForPhoto } from '@/photo';
import { sql } from '@/platforms/postgres';

const validateAlbumParent = async (albumId: string, parentId?: string | null) => {
  if (!parentId) return undefined;
  if (parentId === albumId) return 'An album cannot be its own parent';
  const parent = await getAlbumFromId(parentId);
  if (!parent || parent.parentAlbumId) {
    return 'Choose an existing top-level collection';
  }
  if (albumId && await albumHasChildren(albumId)) {
    return 'A collection with child albums must remain top-level';
  }
  return undefined;
};

export const updateAlbumAction = async (formData: FormData) =>
  runAuthenticatedAdminServerAction(async () => {
    const album = convertFormDataToAlbum(formData);
    const validationError = await validateAlbumParent(album.id, album.parentAlbumId);
    if (validationError) return { error: validationError };
    const coverError = await validateAlbumCover(album.id, album.coverPhotoId);
    if (coverError) return { error: coverError };
    await updateAlbum(album);
    revalidateAllKeysAndPaths();
  });

export const createAlbumAction = async (formData: FormData) =>
  runAuthenticatedAdminServerAction(async () => {
    const album = convertFormDataToAlbum(formData);
    const validationError = await validateAlbumParent('', album.parentAlbumId);
    if (validationError) return { error: validationError };
    const coverError = await validateAlbumCover('', album.coverPhotoId);
    if (coverError) return { error: coverError };
    const existing = await getAlbumFromSlug(album.slug);
    if (existing) {
      return { error: 'An album with this name already exists' };
    }
    await insertAlbum({
      title: album.title,
      slug: album.slug,
      subhead: album.subhead,
      description: album.description,
      location: album.location,
      parentAlbumId: album.parentAlbumId,
      sortOrder: album.sortOrder,
      coverPhotoId: album.coverPhotoId,
      durationDays: album.durationDays,
      distanceKm: album.distanceKm,
    });

    revalidateAllKeysAndPaths();
  });

export const getPublicAlbumCoverChoicesAction = async (
  albumId: string,
  offset: number,
) => runAuthenticatedAdminServerAction(async () => {
  const album = await getAlbumFromId(albumId);
  if (!album) return { photos: [], total: 0 };
  const [photos, summary] = await Promise.all([
    getPhotosCached({
      album,
      excludeFromFeeds: true,
      hidden: 'exclude',
      sortBy: 'takenAt',
      sortWithPriority: false,
      albumSortOrder: true,
      limit: 30,
      offset: Math.max(0, offset),
    }),
    getPhotosMetaCached({
      album,
      excludeFromFeeds: true,
      hidden: 'exclude',
    }),
  ]);
  return {
    photos: photos.map(photo => ({
      id: photo.id,
      title: titleForPhoto(photo),
      takenAt: photo.takenAt.toISOString(),
    })),
    total: summary.count,
  };
});

const validateAlbumCover = async (albumId: string, coverPhotoId?: string | null) => {
  if (!coverPhotoId) return undefined;
  const { rows } = await sql`
    SELECT 1 FROM album_photo ap
    JOIN photos p ON p.id=ap.photo_id
    WHERE ap.album_id=${albumId} AND ap.photo_id=${coverPhotoId}
      AND p.hidden IS NOT TRUE AND p.exclude_from_feeds IS NOT TRUE
    LIMIT 1
  `;
  return rows.length ? undefined : 'Choose a public photo assigned to this album';
};

export const deleteAlbumFormAction = async (formData: FormData) =>
  runAuthenticatedAdminServerAction(async () => {
    const albumId = formData.get('album') as string;
    await deleteAlbum(albumId);
    revalidateAllKeysAndPaths();
  });

export const deleteAlbumAction = async (
  album: Album,
  currentPath?: string,
) =>
  runAuthenticatedAdminServerAction(async () => {
    await deleteAlbum(album.id);
    revalidateAllKeysAndPaths();
    if (currentPath === pathForAlbum(album)) {
      redirect(PATH_ROOT);
    }
  });
