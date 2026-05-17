import { NextResponse } from 'next/server';
import { readCouplets, batchUpdateCouplets } from '@/lib/data';
import { draftCouplet } from '@/lib/claude';
import { log } from '@/lib/logger';

export async function POST(req: Request) {
  const { ids } = (await req.json()) as { ids: string[] };

  const all      = await readCouplets();
  const approved = all.filter(c => c.status === 'approved');

  // Draft all couplets in parallel, then write to GitHub in one commit
  const pending = ids
    .map(id => all.find(x => x.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c && c.status === 'untranslated');

  const drafts = await Promise.allSettled(
    pending.map(c => draftCouplet(c.farsi, approved.slice(-3)))
  );

  const updates = pending
    .map((c, i) => {
      const r = drafts[i];
      if (r.status === 'rejected') { console.error(`Draft failed for ${c.id}:`, r.reason); return null; }
      return { id: c.id, changes: { status: 'draft' as const, punjabi_draft: r.value, punjabi_final: r.value } };
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);

  const results = await batchUpdateCouplets(updates);
  results.forEach((c, i) => log({ couplet_id: c.id, action: 'draft_generated', before: null, after: updates[i].changes.punjabi_final! }));

  return NextResponse.json(results);
}
