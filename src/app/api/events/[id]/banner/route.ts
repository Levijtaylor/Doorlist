import { getEvent } from '@/lib/events';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const event = getEvent(params.id);
  const match = event?.banner_image && /^data:(image\/[a-z]+);base64,(.+)$/.exec(event.banner_image);
  if (!match) return new Response('No banner image', { status: 404 });
  return new Response(Buffer.from(match[2], 'base64'), {
    headers: {
      'Content-Type': match[1],
      // URLs carry ?v=<updated_at>, so a changed banner gets a new URL.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
