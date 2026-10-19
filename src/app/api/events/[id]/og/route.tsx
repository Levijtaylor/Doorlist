import { ImageResponse } from 'next/og';
import { getEvent } from '@/lib/events';
import { presetFor } from '@/lib/banners';
import { formatWhen } from '@/lib/format';

export const runtime = 'nodejs';

/** The preview card messaging apps show when someone pastes an invite link. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const e = await getEvent(params.id);
  if (!e) return new Response('Not found', { status: 404 });

  // Next 14's image renderer can't resolve its bundled font path on Windows, so local
  // Windows dev serves the uploaded banner (or nothing). Linux hosts render the full card.
  if (process.platform === 'win32') {
    return e.banner_image ? Response.redirect(new URL(`/api/events/${e.id}/banner?v=${encodeURIComponent(e.updated_at)}`, _req.url), 302) : new Response('Preview card unavailable on Windows', { status: 404 });
  }

  const when = formatWhen(e.starts_at, e.ends_at, e.timezone);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: presetFor(e.banner_preset).og }}>
        {e.banner_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.banner_image} width={1200} height={630} style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, objectFit: 'cover' }} alt="" />
        ) : null}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', background: 'linear-gradient(180deg, rgba(0,0,0,0) 25%, rgba(0,0,0,0.7) 100%)' }} />
        <div style={{ position: 'absolute', left: 64, right: 64, bottom: 56, display: 'flex', flexDirection: 'column', color: 'white' }}>
          <div style={{ fontSize: 32, opacity: 0.92 }}>{`${when.date} · ${when.time}`}</div>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, marginTop: 8 }}>{e.title}</div>
          <div style={{ fontSize: 28, marginTop: 20, opacity: 0.85 }}>You’re invited. Tap to RSVP.</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
