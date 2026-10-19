import { NextResponse } from 'next/server';
import type { z, ZodTypeAny } from 'zod';

export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function parseBody<S extends ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<{ data: z.output<S>; error?: undefined } | { data?: undefined; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: fail('The request was not valid JSON.') };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    return { error: fail(issue?.message ?? 'Some fields are invalid.') };
  }
  return { data: result.data };
}
