type Action = 'draft_generated' | 'word_swap' | 'regenerate' | 'approve' | 'publish';

export function log(entry: {
  couplet_id: string;
  action: Action;
  before: string | null;
  after: string;
  details?: Record<string, unknown>;
}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }));
}
