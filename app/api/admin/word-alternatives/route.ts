import { NextResponse } from 'next/server';
import { wordAlternatives } from '@/lib/claude';

export async function POST(req: Request) {
  const { farsi, currentDraft, clickedWord } = await req.json();
  const alternatives = await wordAlternatives(farsi, currentDraft, clickedWord);
  return NextResponse.json({ alternatives });
}
