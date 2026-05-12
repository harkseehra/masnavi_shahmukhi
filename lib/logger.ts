import fs from 'fs';
import path from 'path';

const LOG_DIR  = path.join(process.cwd(), 'data', 'logs');
const LOG_PATH = path.join(LOG_DIR, 'book_4.jsonl');

type Action = 'draft_generated' | 'word_swap' | 'regenerate' | 'approve' | 'publish';

export function log(entry: {
  couplet_id: string;
  action: Action;
  before: string | null;
  after: string;
  details?: Record<string, unknown>;
}) {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(LOG_PATH, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n', 'utf-8');
}
