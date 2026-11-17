import AdminAlbumCreateClient from '@/admin/AdminAlbumCreateClient';
import { HAS_LOCATION_SERVICES } from '@/app/config';
import { getAlbumsWithMeta } from '@/album/query';

export default async function AdminAlbumCreatePage() {
  const albums = await getAlbumsWithMeta().catch(() => []);
  return (
    <AdminAlbumCreateClient
      hasLocationServices={HAS_LOCATION_SERVICES}
      topLevelAlbums={albums
        .map(({ album }) => album)
        .filter(album => !album.parentAlbumId)}
    />
  );
}
