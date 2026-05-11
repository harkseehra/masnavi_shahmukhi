import fs from 'fs';
import path from 'path';
import type { Couplet } from '@/types';

const DATA_PATH   = path.join(process.cwd(), 'data', 'book_4.json');
const PUBLIC_PATH = path.join(process.cwd(), 'public', 'book_4.json');

export function readCouplets(): Couplet[] {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
}

export function writeCouplets(couplets: Couplet[]): void {
  fs.writeFileSync(DATA_PATH, JSON.stringify(couplets, null, 2), 'utf-8');
}

export function updateCouplet(id: string, updates: Partial<Couplet>): Couplet {
  const couplets = readCouplets();
  const idx = couplets.findIndex(c => c.id === id);
  if (idx === -1) throw new Error(`Couplet ${id} not found`);
  couplets[idx] = { ...couplets[idx], ...updates };
  writeCouplets(couplets);
  return couplets[idx];
}

export function publishApproved(): void {
  const couplets = readCouplets();
  const approved = couplets.filter(c => c.status === 'approved');
  fs.writeFileSync(PUBLIC_PATH, JSON.stringify(approved, null, 2), 'utf-8');
}
