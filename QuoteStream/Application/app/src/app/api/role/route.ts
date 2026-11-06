import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const role = b.role === 'gac' ? 'gac' : 'customer';
  const res = NextResponse.json({ role });
  res.cookies.set('role', role, { path: '/', httpOnly: false, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 });
  return res;
}
