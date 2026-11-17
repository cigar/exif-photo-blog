import { AnnotatedTag, FieldSetType } from '@/photo/form';
import { Album, Albums } from '.';
import { formatCount, formatCountDescriptive } from '@/utility/string';

export const ALBUM_FORM_META: {
  key: keyof Album
  label?: string
  type: FieldSetType
  required?: boolean
  readOnly?: boolean
}[] = [
  { key: 'id', type: 'hidden', readOnly: true },
  { key: 'title', type: 'text', required: true },
  { key: 'slug', type: 'text', required: true, readOnly: true },
  { key: 'subhead', type: 'text' },
  { key: 'description', type: 'textarea' },
  { key: 'sortOrder', label: 'Sort order', type: 'text' },
  { key: 'durationDays', label: 'Duration in days', type: 'text' },
  { key: 'distanceKm', label: 'Distance in km', type: 'text' },
];

export const convertFormDataToAlbum = (formData: FormData): Album => {
  const locationString = formData.get('location') as string | undefined;
  return {
    id: formData.get('id') as string,
    title: formData.get('title') as string,
    slug: formData.get('slug') as string,
    subhead: formData.get('subhead') as string,
    description: formData.get('description') as string,
    parentAlbumId: (formData.get('parentAlbumId') as string) || null,
    sortOrder: Number(formData.get('sortOrder') || 0),
    coverPhotoId: (formData.get('coverPhotoId') as string) || null,
    durationDays: formData.get('durationDays') ? Number(formData.get('durationDays')) : null,
    distanceKm: formData.get('distanceKm') ? Number(formData.get('distanceKm')) : null,
    ...locationString && { location: JSON.parse(locationString) },
  };
};

export const convertAlbumsToAnnotatedTags = (
  albums: Albums = [],
): AnnotatedTag[] =>
  albums
    .sort((a, b) => a.album.title.localeCompare(b.album.title))
    .map(({ album, count }) => ({
      value: album.title,
      annotation: formatCount(count),
      annotationAria: formatCountDescriptive(count),
    }));

export const getAlbumTitlesFromFormData = (formData: FormData) =>
  formData.get('albums')?.toString().split(',').filter(Boolean) ?? [];
