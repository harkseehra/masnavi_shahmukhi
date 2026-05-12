import { NextResponse } from 'next/server';
import { publishApproved, readCouplets } from '@/lib/data';
import { log } from '@/lib/logger';

export async function POST() {
  const all      = readCouplets();
  const approved = all.filter(c => c.status === 'approved');

  publishApproved();
  log({ couplet_id: 'batch', action: 'publish', before: null, after: `${approved.length} couplets published` });

  return NextResponse.json({ published: approved.length });
}
