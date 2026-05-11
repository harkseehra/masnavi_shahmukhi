import { NextResponse } from 'next/server';
import { updateCouplet } from '@/lib/data';
import type { CoupletStatus } from '@/types';

export async function POST(req: Request) {
  const { id, status } = (await req.json()) as { id: string; status: CoupletStatus };

  const updated = updateCouplet(id, {
    status,
    approved_at: status === 'approved' ? new Date().toISOString() : null,
  });

  return NextResponse.json(updated);
}
