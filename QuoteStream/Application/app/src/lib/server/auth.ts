import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { q1 } from '../db';

export type Role = 'customer' | 'gac';

export async function getRole(): Promise<Role> {
  const c = await cookies();
  return c.get('role')?.value === 'gac' ? 'gac' : 'customer';
}

export async function customerPrincipalId(): Promise<number> {
  const row = await q1<{ principal_id: number }>("SELECT principal_id FROM app_user WHERE kind = 'customer' LIMIT 1");
  return row!.principal_id;
}

export function forbidden() {
  return NextResponse.json({ error: 'Not allowed for this user' }, { status: 403 });
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function ok(data: unknown) {
  return NextResponse.json(data, { headers: { 'cache-control': 'no-store' } });
}

export async function gacOnly(): Promise<NextResponse | null> {
  return (await getRole()) === 'gac' ? null : forbidden();
}

export async function customerOnly(): Promise<NextResponse | null> {
  return (await getRole()) === 'customer' ? null : forbidden();
}
