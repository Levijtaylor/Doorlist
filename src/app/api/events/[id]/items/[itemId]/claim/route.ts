import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { currentPerson } from '@/lib/auth';
import { fail, parseBody } from '@/lib/api';
import { claimSchema } from '@/lib/schemas';
import { getRsvp } from '@/lib/events';

export async function POST(req: Request, { params }: { params: { id: string; itemId: string } }) {
  const me = await currentPerson();
  if (!me) return fail('RSVP first, then pick what you’ll bring.', 401);

  const { data, error } = await parseBody(req, claimSchema);
  if (error) return error;

  const item = await get<{ id: string; name: string; quantity: number }>('SELECT id, name, quantity FROM items WHERE id = ? AND event_id = ?', params.itemId, params.id);
  if (!item) return fail('That item was removed from the list.', 404);

  const rsvp = await getRsvp(params.id, me.id);
  if (!rsvp || rsvp.status === 'declined') return fail('RSVP as going or maybe to sign up to bring something.', 403);

  if (data.quantity === 0) {
    await run('DELETE FROM item_claims WHERE item_id = ? AND person_id = ?', item.id, me.id);
    return NextResponse.json({ ok: true });
  }

  // Claim only if it still fits: the check and the write happen in one statement, so two
  // guests claiming the last one at the same moment can't both win.
  await run(
    `INSERT INTO item_claims (item_id, person_id, quantity)
     SELECT ?, ?, ? WHERE (SELECT COALESCE(SUM(quantity), 0) FROM item_claims WHERE item_id = ? AND person_id != ?) + ? <= ?
     ON CONFLICT (item_id, person_id) DO UPDATE SET quantity = excluded.quantity`,
    item.id,
    me.id,
    data.quantity,
    item.id,
    me.id,
    data.quantity,
    item.quantity,
  );

  const mine = await get<{ quantity: number }>('SELECT quantity FROM item_claims WHERE item_id = ? AND person_id = ?', item.id, me.id);
  if (mine?.quantity !== data.quantity) {
    const { others } = (await get<{ others: number }>('SELECT COALESCE(SUM(quantity), 0) AS others FROM item_claims WHERE item_id = ? AND person_id != ?', item.id, me.id))!;
    const left = item.quantity - others;
    return fail(left > 0 ? `Only ${left} more ${item.name} needed.` : `${item.name} is already covered.`, 409);
  }
  return NextResponse.json({ ok: true });
}
