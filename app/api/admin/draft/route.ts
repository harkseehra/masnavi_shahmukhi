import { NextResponse } from 'next/server';
import { readCouplets, updateCouplet } from '@/lib/data';
import { draftCouplet } from '@/lib/claude';
import { log } from '@/lib/logger';

export async function POST(req: Request) {
  const { ids } = (await req.json()) as { ids: string[] };

  const all      = readCouplets();
  const approved = all.filter(c => c.status === 'approved');
  const results  = [];

  for (const id of ids) {
    const c = all.find(x => x.id === id);
    if (!c || c.status !== 'untranslated') continue;

    try {
      const draft   = await draftCouplet(c.farsi, approved.slice(-3));
      const updated = updateCouplet(id, { status: 'draft', punjabi_draft: draft, punjabi_final: draft });
      log({ couplet_id: id, action: 'draft_generated', before: null, after: draft });
      results.push(updated);
    } catch (err) {
      console.error(`Draft failed for ${id}:`, err);
    }
  }

  return NextResponse.json(results);
}
