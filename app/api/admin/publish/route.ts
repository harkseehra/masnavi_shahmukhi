import { NextResponse } from 'next/server';
import { publishApproved } from '@/lib/data';
import { log } from '@/lib/logger';

export async function POST() {
  const count = await publishApproved();
  log({ couplet_id: 'batch', action: 'publish', before: null, after: `${count} couplets published` });
  return NextResponse.json({ published: count });
}
