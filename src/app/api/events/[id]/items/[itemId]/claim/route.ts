import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { currentPerson } from '@/lib/auth';
import { fail, parseBody } from '@/lib/api';
import { claimSchema } from '@/lib/schemas';
import { getRsvp } from '@/lib/events';

export async function POST(req: Request, { params }: { params: { id: string; itemId: string } }) {
  const me = currentPerson();
  if (!me) return fail('RSVP first, then pick what you’ll bring.', 401);

  const { data, error } = await parseBody(req, claimSchema);
  if (error) return error;

  const item = db.prepare('SELECT id, name, quantity FROM items WHERE id = ? AND event_id = ?').get(params.itemId, params.id) as
    | { id: string; name: string; quantity: number }
    | undefined;
  if (!item) return fail('That item was removed from the list.', 404);

  const rsvp = getRsvp(params.id, me.id);
  if (!rsvp || rsvp.status === 'declined') return fail('RSVP as going or maybe to sign up to bring something.', 403);

  if (data.quantity === 0) {
    db.prepare('DELETE FROM item_claims WHERE item_id = ? AND person_id = ?').run(item.id, me.id);
    return NextResponse.json({ ok: true });
  }

  const { others } = db
    .prepare('SELECT COALESCE(SUM(quantity), 0) AS others FROM item_claims WHERE item_id = ? AND person_id != ?')
    .get(item.id, me.id) as { others: number };
  if (others + data.quantity > item.quantity) {
    const left = item.quantity - others;
    return fail(left > 0 ? `Only ${left} more ${item.name} needed.` : `${item.name} is already covered.`, 409);
  }

  db.prepare(
    `INSERT INTO item_claims (item_id, person_id, quantity) VALUES (?, ?, ?)
     ON CONFLICT (item_id, person_id) DO UPDATE SET quantity = excluded.quantity`,
  ).run(item.id, me.id, data.quantity);
  return NextResponse.json({ ok: true });
}
