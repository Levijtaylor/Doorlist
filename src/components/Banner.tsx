import { presetFor } from '@/lib/banners';

export function bannerSrc(e: { id: string; banner_image: string | null; updated_at: string }): string | null {
  return e.banner_image ? `/api/events/${e.id}/banner?v=${encodeURIComponent(e.updated_at)}` : null;
}

/** A banner surface: a preset pattern, optionally covered by an uploaded photo. */
export default function Banner({
  preset,
  imageSrc,
  className = 'banner',
  children,
}: {
  preset: string;
  imageSrc: string | null;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={className} style={{ background: presetFor(preset).css }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {imageSrc && <img src={imageSrc} alt="" />}
      {children}
    </div>
  );
}
