'use client';

import { AiFillApple } from 'react-icons/ai';
import { pathForCamera, pathForCameraImage } from '@/app/paths';
import { Camera, formatCameraText } from '.';
import EntityLink, {
  EntityLinkExternalProps,
} from '@/components/primitives/EntityLink';
import IconCamera from '@/components/icons/IconCamera';
import { isCameraApple } from '@/platforms/apple';
import { useAppText } from '@/i18n/state/client';
import { photoQuantityText } from '@/photo';

export default function PhotoCamera({
  camera,
  hideAppleIcon,
  countOnHover,
  ...props
}: {
  camera: Camera
  hideAppleIcon?: boolean
  countOnHover?: number
} & EntityLinkExternalProps) {
  const appText = useAppText();
  const isApple = isCameraApple(camera);
  const showAppleIcon = !hideAppleIcon && isApple;

  return (
    <EntityLink
      {...props}
      label={formatCameraText(camera)}
      path={pathForCamera(camera)}
      tooltipImagePath={pathForCameraImage(camera)}
      tooltipCaption={countOnHover &&
        photoQuantityText(countOnHover, appText, false)}
      icon={showAppleIcon
        ? <AiFillApple
          title="Apple"
          className="translate-x-[-0.5px] translate-y-[-1px]"
          size={16}
        />
        : <IconCamera
          size={15}
          className="translate-x-[-0.5px] translate-y-[-0.5px]"
        />}
      hoverEntity={countOnHover}
    />
  );
}
