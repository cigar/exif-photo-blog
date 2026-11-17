'use client';

import { useState } from 'react';
import { regeneratePhotoVariantsAction } from './actions';

export default function RegeneratePhotoVariantsButton({ photoId }: { photoId: string }) {
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState('');

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="button"
        disabled={isPending}
        onClick={async () => {
          setIsPending(true);
          setMessage('');
          try {
            const result = await regeneratePhotoVariantsAction(photoId);
            setMessage('error' in result
              ? result.error ?? 'Could not regenerate image variants'
              : 'Image variants regenerated');
          } catch {
            setMessage('Could not regenerate image variants');
          } finally {
            setIsPending(false);
          }
        }}
      >
        {isPending ? 'Regenerating…' : 'Regenerate image variants'}
      </button>
      {message && <span className="text-xs text-dim">{message}</span>}
    </div>
  );
}
