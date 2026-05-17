import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { readCouplets } from '@/lib/data';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const offset = parseInt(searchParams.get('offset') ?? '0');
  const size   = parseInt(searchParams.get('size')   ?? '25');

  const all   = await readCouplets();
  const slice = all.slice(offset, offset + size);

  return NextResponse.json({ couplets: slice, total: all.length, offset, size });
}
