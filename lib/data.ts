import type { Couplet } from '@/types';

const OWNER  = process.env.GITHUB_OWNER!;
const REPO   = process.env.GITHUB_REPO!;
const BRANCH = process.env.GITHUB_BRANCH ?? 'main';
const TOKEN  = process.env.GITHUB_TOKEN!;

const DATA_PATH   = 'data/book_4.json';
const PUBLIC_PATH = 'public/book_4.json';

const GH_HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

interface GHFileResponse { content: string; sha: string; }
interface GHPutResponse  { content: { sha: string } }

async function ghGet(filePath: string): Promise<GHFileResponse> {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${BRANCH}`,
    { headers: GH_HEADERS, cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`GH GET ${filePath}: ${res.status}`);
  return res.json() as Promise<GHFileResponse>;
}

async function ghPut(filePath: string, json: string, sha: string | null, message: string): Promise<string> {
  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(json, 'utf-8').toString('base64'),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`,
    {
      method: 'PUT',
      headers: { ...GH_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GH PUT ${filePath}: ${res.status} ${err}`);
  }
  const data = await res.json() as GHPutResponse;
  return data.content.sha;
}

// Module-level cache — avoids re-fetching within the same serverless invocation
let _cache: { sha: string; couplets: Couplet[] } | null = null;

export async function readCouplets(): Promise<Couplet[]> {
  if (_cache) return _cache.couplets;
  const file     = await ghGet(DATA_PATH);
  const json     = Buffer.from(file.content, 'base64').toString('utf-8');
  const couplets = JSON.parse(json) as Couplet[];
  _cache = { sha: file.sha, couplets };
  return couplets;
}

export async function writeCouplets(couplets: Couplet[]): Promise<void> {
  const sha    = _cache?.sha ?? (await ghGet(DATA_PATH)).sha;
  const json   = JSON.stringify(couplets, null, 2);
  const newSha = await ghPut(DATA_PATH, json, sha, 'translations: update book 4');
  _cache = { sha: newSha, couplets };
}

export async function updateCouplet(id: string, updates: Partial<Couplet>): Promise<Couplet> {
  const couplets = await readCouplets();
  const idx      = couplets.findIndex(c => c.id === id);
  if (idx === -1) throw new Error(`Couplet ${id} not found`);
  couplets[idx]  = { ...couplets[idx], ...updates };
  await writeCouplets(couplets);
  return couplets[idx];
}

// Applies multiple updates in one GitHub write instead of one PUT per couplet
export async function batchUpdateCouplets(
  updates: Array<{ id: string; changes: Partial<Couplet> }>
): Promise<Couplet[]> {
  const couplets = await readCouplets();
  const results: Couplet[] = [];
  for (const { id, changes } of updates) {
    const idx = couplets.findIndex(c => c.id === id);
    if (idx === -1) continue;
    couplets[idx] = { ...couplets[idx], ...changes };
    results.push(couplets[idx]);
  }
  await writeCouplets(couplets);
  return results;
}

export async function publishApproved(): Promise<number> {
  const couplets = await readCouplets();
  const approved = couplets.filter(c => c.status === 'approved');
  const json     = JSON.stringify(approved, null, 2);

  let sha: string | null = null;
  try {
    const f = await ghGet(PUBLIC_PATH);
    sha = f.sha;
  } catch {
    // File doesn't exist yet — GitHub API creates it without sha
  }

  await ghPut(PUBLIC_PATH, json, sha, `publish: ${approved.length} approved Punjabi translations`);
  return approved.length;
}
