import { NextResponse } from 'next/server';
import { readCouplets, updateCouplet } from '@/lib/data';
import { regenerateCouplet } from '@/lib/claude';
import { log } from '@/lib/logger';

export async function POST(req: Request) {
  const { id, farsi, draftWithEdits, romanInput } = await req.json();

  const before  = draftWithEdits as string;
  const newText = await regenerateCouplet(farsi, draftWithEdits, romanInput ?? '');

  const all     = readCouplets();
  const current = all.find(c => c.id === id);
  const updated = updateCouplet(id, {
    punjabi_final: newText,
    edit_count: (current?.edit_count ?? 0) + 1,
  });

  log({ couplet_id: id, action: 'regenerate', before, after: newText });
  return NextResponse.json(updated);
}
