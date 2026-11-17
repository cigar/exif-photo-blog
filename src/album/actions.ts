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
    await updateAlbum(album);
    revalidateAllKeysAndPaths();
  });

export const createAlbumAction = async (formData: FormData) =>
  runAuthenticatedAdminServerAction(async () => {
    const album = convertFormDataToAlbum(formData);
    const validationError = await validateAlbumParent('', album.parentAlbumId);
    if (validationError) return { error: validationError };
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
