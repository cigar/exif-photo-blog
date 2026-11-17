import AdminPage from '@/admin/AdminPage';
import { redirect } from 'next/navigation';
import { getPhotosCached, getPhotosMetaCached } from '@/photo/cache';
import {
  PARAM_REDIRECT,
  PATH_ADMIN,
  PATH_ADMIN_ALBUMS,
  pathForAlbum,
} from '@/app/path';
import PhotoLightbox from '@/photo/PhotoLightbox';
import {
  getAlbumFromSlug,
  getAlbumsWithMeta,
  getPublicAlbumSummary,
} from '@/album/query';
import AdminAlbumBadge from '@/admin/AdminAlbumBadge';
import AdminAlbumForm from '@/admin/AdminAlbumForm';
import { HAS_LOCATION_SERVICES } from '@/app/config';

const MAX_PHOTO_TO_SHOW = 6;

interface Props {
  params: Promise<{ album: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AlbumPageEdit({
  params,
  searchParams,
}: Props) {
  const { album: albumFromParams } = await params;
  const redirectPath = (await searchParams)[PARAM_REDIRECT];

  const albumSlug = decodeURIComponent(albumFromParams);

  const album = await getAlbumFromSlug(albumSlug);

  if (!album) { redirect(PATH_ADMIN); }
  
  const [
    { count },
    photos,
    albumSummary,
    allAlbums,
  ] = await Promise.all([
    getPhotosMetaCached({ album }),
    getPhotosCached({ album, limit: MAX_PHOTO_TO_SHOW }),
    getPublicAlbumSummary(album.id),
    getAlbumsWithMeta().catch(() => []),
  ]);

  return (
    <AdminPage
      backPath={PATH_ADMIN_ALBUMS}
      backLabel="Albums"
      breadcrumb={<AdminAlbumBadge {...{ album, count, hideBadge: true }} />}
    >
      <AdminAlbumForm {...{
        album,
        hasLocationServices: HAS_LOCATION_SERVICES,
        redirectPath: typeof redirectPath === 'string'
          ? redirectPath
          : undefined,
        publicPhotoCount: albumSummary.photoCount,
        publicAlbumCount: albumSummary.nonEmptyAlbumCount,
        topLevelAlbums: allAlbums
          .map(({ album: available }) => available)
          .filter(available => !available.parentAlbumId && available.id !== album.id),
        canChangeParent: !allAlbums.some(({ album: child }) =>
          child.parentAlbumId === album.id),
      }}>
        {photos.length > 0 &&
          <PhotoLightbox
            {...{ count, photos, album }}
            maxPhotosToShow={MAX_PHOTO_TO_SHOW}
            moreLink={pathForAlbum(album)}
          />}
      </AdminAlbumForm>
    </AdminPage>
  );
};
