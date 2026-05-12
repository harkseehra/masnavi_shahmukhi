import { NextResponse } from 'next/server';
import { readCouplets, updateCouplet } from '@/lib/data';
import { log } from '@/lib/logger';

export async function POST(req: Request) {
  const { id, before, after } = await req.json() as { id: string; before: string; after: string };

  const all     = readCouplets();
  const current = all.find(c => c.id === id);
  if (!current) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const newFinal = current.punjabi_final.replace(before, after);
  const updated  = updateCouplet(id, {
    punjabi_final: newFinal,
    edit_count: current.edit_count + 1,
  });

  log({ couplet_id: id, action: 'word_swap', before, after });
  return NextResponse.json(updated);
}
