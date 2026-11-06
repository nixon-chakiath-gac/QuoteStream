import { NextResponse } from 'next/server';
import { FlowError } from './flow';
import { gacOnly, customerOnly } from './auth';

type Guard = 'gac' | 'customer' | 'any';

export function route<C = any>(guard: Guard, fn: (req: Request, ctx: C) => Promise<unknown>) {
  return async (req: Request, ctx: C) => {
    try {
      if (guard === 'gac') {
        const g = await gacOnly();
        if (g) return g;
      }
      if (guard === 'customer') {
        const g = await customerOnly();
        if (g) return g;
      }
      const out = await fn(req, ctx);
      if (out instanceof NextResponse) return out;
      return NextResponse.json(out ?? { ok: true }, { headers: { 'cache-control': 'no-store' } });
    } catch (e: any) {
      if (e instanceof FlowError) return NextResponse.json({ error: e.message }, { status: e.status });
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
  };
}

export async function body(req: Request): Promise<Record<string, any>> {
  try {
    return (await req.json()) as Record<string, any>;
  } catch {
    return {};
  }
}

export type IdCtx = { params: Promise<{ id: string }> };
export async function idOf(ctx: IdCtx): Promise<number> {
  const p = await ctx.params;
  const n = Number(p.id);
  if (!Number.isInteger(n)) throw new FlowError('Not found', 404);
  return n;
}
