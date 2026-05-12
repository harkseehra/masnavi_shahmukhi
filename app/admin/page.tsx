'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Couplet, CoupletStatus } from '@/types';

const BATCH_SIZES = [10, 25, 50] as const;
type BatchSize = typeof BATCH_SIZES[number];
type AdminFont = 'vazir' | 'nazanin' | 'nastaliq';

type WordPopover = {
  coupletId: string;
  word: string;
  alternatives: string[] | null;
  x: number;
  y: number;
};

function applyFont(f: AdminFont) {
  document.documentElement.dataset.font = f;
  localStorage.setItem('ms-admin-font', f);
}

async function pLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += limit) {
    const chunk = await Promise.all(tasks.slice(i, i + limit).map(t => t()));
    results.push(...chunk);
  }
  return results;
}

export default function AdminPage() {
  const [couplets, setCouplets]   = useState<Couplet[]>([]);
  const [total, setTotal]         = useState(0);
  const [offset, setOffset]       = useState(0);
  const [batchSize, setBatchSize] = useState<BatchSize>(25);
  const [loading, setLoading]     = useState(true);
  const [jumpVal, setJumpVal]     = useState('');
  const [font, setFont]           = useState<AdminFont>('vazir');
  const [saving, setSaving]       = useState<Set<string>>(new Set());
  const [drafting, setDrafting]   = useState<Set<string>>(new Set());
  const [regenerating, setRegen]  = useState<Set<string>>(new Set());
  const [romanInput, setRoman]    = useState<Record<string, string>>({});
  const [popover, setPopover]     = useState<WordPopover | null>(null);
  const popoverRef                = useRef<HTMLDivElement>(null);

  const load = useCallback(async (off: number, size: BatchSize) => {
    setLoading(true);
    const res  = await fetch(`/api/admin/couplets?offset=${off}&size=${size}`);
    const data = await res.json();
    setCouplets(data.couplets);
    setTotal(data.total);
    setLoading(false);
    return data.couplets as Couplet[];
  }, []);

  // Auto-draft untranslated couplets, 5 concurrent
  const autoDraft = useCallback(async (cs: Couplet[]) => {
    const untranslated = cs.filter(c => c.status === 'untranslated').map(c => c.id);
    if (untranslated.length === 0) return;

    setDrafting(new Set(untranslated));

    const tasks = untranslated.map(id => async () => {
      const res  = await fetch('/api/admin/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      const results: Couplet[] = await res.json();
      if (results.length > 0) {
        setCouplets(prev => prev.map(c => c.id === id ? results[0] : c));
      }
      setDrafting(prev => { const n = new Set(prev); n.delete(id); return n; });
    });

    await pLimit(tasks, 5);
  }, []);

  useEffect(() => {
    const f = localStorage.getItem('ms-admin-font') as AdminFont | null;
    if (f) { setFont(f); applyFont(f); }
    load(0, 25).then(autoDraft);
  }, [load, autoDraft]);

  // Close popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopover(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function toggleApprove(c: Couplet) {
    const next: CoupletStatus = c.status === 'approved' ? 'draft' : 'approved';
    setSaving(s => new Set(s).add(c.id));
    const res     = await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, status: next }),
    });
    const updated: Couplet = await res.json();
    setCouplets(cs => cs.map(x => x.id === updated.id ? updated : x));
    setSaving(s => { const n = new Set(s); n.delete(c.id); return n; });
  }

  async function handleWordClick(c: Couplet, word: string, rect: DOMRect) {
    setPopover({ coupletId: c.id, word, alternatives: null, x: rect.left, y: rect.bottom + 6 });
    const res  = await fetch('/api/admin/word-alternatives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ farsi: c.farsi, currentDraft: c.punjabi_final, clickedWord: word }),
    });
    const data = await res.json();
    setPopover(p => p?.word === word && p.coupletId === c.id ? { ...p, alternatives: data.alternatives } : p);
  }

  async function handleWordSwap(coupletId: string, before: string, after: string) {
    setPopover(null);
    const res     = await fetch('/api/admin/word-swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: coupletId, before, after }),
    });
    const updated: Couplet = await res.json();
    setCouplets(cs => cs.map(c => c.id === updated.id ? updated : c));
  }

  async function handleRegenerate(c: Couplet) {
    setRegen(s => new Set(s).add(c.id));
    const res     = await fetch('/api/admin/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, farsi: c.farsi, draftWithEdits: c.punjabi_final, romanInput: romanInput[c.id] ?? '' }),
    });
    const updated: Couplet = await res.json();
    setCouplets(cs => cs.map(x => x.id === updated.id ? updated : x));
    setRoman(r => ({ ...r, [c.id]: '' }));
    setRegen(s => { const n = new Set(s); n.delete(c.id); return n; });
  }

  function changeBatch(size: BatchSize) {
    setBatchSize(size);
    setOffset(0);
    load(0, size).then(autoDraft);
  }

  function jump() {
    const n = parseInt(jumpVal);
    if (isNaN(n) || n < 1 || n > total) return;
    const off = Math.max(0, Math.floor((n - 1) / batchSize) * batchSize);
    setOffset(off);
    load(off, batchSize).then(autoDraft);
    setJumpVal('');
  }

  function prev() {
    const off = Math.max(0, offset - batchSize);
    setOffset(off);
    load(off, batchSize).then(autoDraft);
  }
  function next() {
    const off = offset + batchSize;
    if (off < total) { setOffset(off); load(off, batchSize).then(autoDraft); }
  }

  const onFont      = (f: AdminFont) => { setFont(f); applyFont(f); };
  const allApproved = couplets.length > 0 && couplets.every(c => c.status === 'approved');
  const from        = offset + 1;
  const to          = Math.min(offset + batchSize, total);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--c-bg)' }}>
      <nav id="top-nav" aria-label="Workbench navigation">
        <div id="site-logo"><span className="logo-fa">کارگاہ</span></div>
        <span id="nav-book-pill">دفتر چهارم</span>
        <div id="nav-actions">
          <a href="/" className="nav-btn" style={{ fontSize: 12, opacity: 0.5, textDecoration: 'none' }}>Reader</a>
        </div>
      </nav>

      {/* Controls */}
      <div style={{
        position: 'sticky', top: 'calc(var(--nav-h) + var(--progress-h))',
        background: 'var(--c-nav-bg)', borderBottom: '1px solid var(--c-nav-border)',
        zIndex: 500, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {BATCH_SIZES.map(s => (
            <button key={s} className={`settings-opt${batchSize === s ? ' active' : ''}`}
              style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => changeBatch(s)}>{s}</button>
          ))}
        </div>
        <span style={{ fontFamily: 'var(--font-en-sans)', fontSize: 12, color: 'var(--c-text-fa)', opacity: 0.55 }}>
          {from}–{to} of {total} · Book 4
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="number" placeholder="Jump to #" value={jumpVal}
            onChange={e => setJumpVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && jump()}
            style={{ width: 90, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--c-card-border)',
              background: 'var(--c-bg)', color: 'var(--c-text-fa)', fontFamily: 'var(--font-en-sans)', fontSize: 12, outline: 'none' }} />
          <button className="settings-opt" style={{ padding: '6px 12px', fontSize: 12 }} onClick={jump}>Go</button>
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {(['vazir', 'nazanin', 'nastaliq'] as AdminFont[]).map(f => (
            <button key={f} className={`settings-opt${font === f ? ' active' : ''}`}
              style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => onFont(f)}>
              {f === 'vazir' ? 'Naskh' : f === 'nazanin' ? 'Nazanin' : 'Nastaliq'}
            </button>
          ))}
        </div>
      </div>

      {/* Couplet cards */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px 140px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading
          ? <div className="loading-state visible"><div className="loading-spinner" /><span>Loading…</span></div>
          : couplets.map((c, i) => (
            <CoupletCard key={c.id} couplet={c} index={i}
              saving={saving.has(c.id)} drafting={drafting.has(c.id)} regenerating={regenerating.has(c.id)}
              romanInput={romanInput[c.id] ?? ''}
              onRomanChange={v => setRoman(r => ({ ...r, [c.id]: v }))}
              onToggleApprove={() => toggleApprove(c)}
              onWordClick={(word, rect) => handleWordClick(c, word, rect)}
              onRegenerate={() => handleRegenerate(c)}
            />
          ))
        }
      </div>

      {/* Word popover */}
      {popover && (
        <div ref={popoverRef} style={{
          position: 'fixed', left: popover.x, top: popover.y,
          background: 'var(--c-card-bg)', border: '1px solid var(--c-card-border)',
          borderRadius: 10, padding: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          zIndex: 1000, minWidth: 180, direction: 'rtl',
        }}>
          <p style={{ fontFamily: 'var(--font-en-sans)', fontSize: 10, opacity: 0.45, margin: '0 0 8px', direction: 'ltr' }}>
            Alternatives for: <strong>{popover.word}</strong>
          </p>
          {popover.alternatives === null
            ? <div className="loading-spinner" style={{ margin: '8px auto' }} />
            : popover.alternatives.map(alt => (
              <button key={alt} onClick={() => handleWordSwap(popover.coupletId, popover.word, alt)}
                style={{
                  display: 'block', width: '100%', padding: '6px 8px', borderRadius: 6, textAlign: 'right',
                  fontFamily: 'var(--font-fa)', fontSize: 'var(--fz-fa)', color: 'var(--c-text-fa)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  transition: 'background 150ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--c-accent-rgb),0.07)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >{alt}</button>
            ))
          }
          <div style={{ borderTop: '1px solid var(--c-divider)', marginTop: 8, paddingTop: 8 }}>
            <input
              placeholder="اپنا لفظ لکھیں"
              dir="rtl"
              style={{
                width: '100%', padding: '6px 8px', borderRadius: 6,
                border: '1px solid var(--c-card-border)', background: 'var(--c-bg)',
                fontFamily: 'var(--font-fa)', fontSize: 14, color: 'var(--c-text-fa)',
                outline: 'none', boxSizing: 'border-box',
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                  handleWordSwap(popover.coupletId, popover.word, (e.target as HTMLInputElement).value.trim());
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--c-nav-bg)', borderTop: '1px solid var(--c-nav-border)',
        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 400,
      }}>
        <button id="pager-prev" onClick={prev} disabled={offset === 0}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button id="pager-next" onClick={next} disabled={offset + batchSize >= total}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button disabled={!allApproved}
          onClick={() => alert('Phase 4: Approve batch & push to reader')}
          style={{
            marginLeft: 'auto', padding: '10px 20px', borderRadius: 10,
            background: allApproved ? 'var(--c-accent)' : 'var(--c-card-border)',
            color: allApproved ? '#fff' : 'var(--c-text-fa)',
            fontFamily: 'var(--font-en-sans)', fontSize: 13, fontWeight: 600,
            opacity: allApproved ? 1 : 0.4, cursor: allApproved ? 'pointer' : 'default',
          }}
        >
          Approve Batch & Push to Reader
        </button>
      </div>
    </div>
  );
}

function CoupletCard({
  couplet: c, index: i, saving, drafting, regenerating,
  romanInput, onRomanChange, onToggleApprove, onWordClick, onRegenerate,
}: {
  couplet: Couplet; index: number;
  saving: boolean; drafting: boolean; regenerating: boolean;
  romanInput: string;
  onRomanChange: (v: string) => void;
  onToggleApprove: () => void;
  onWordClick: (word: string, rect: DOMRect) => void;
  onRegenerate: () => void;
}) {
  const approved       = c.status === 'approved';
  const hasTranslation = c.punjabi_final.trim().length > 0;
  const busy           = saving || regenerating;

  return (
    <div className="verse-unit" style={{ ['--i' as string]: i, opacity: busy ? 0.7 : 1, transition: 'opacity 150ms' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontFamily: 'var(--font-mono,monospace)', fontSize: 11, color: 'var(--c-verse-num)', letterSpacing: '0.06em' }}>
          #{c.id}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
          color: approved ? '#007F7A' : c.status === 'draft' ? 'var(--c-accent)' : 'var(--c-text-fa)',
          opacity: c.status === 'untranslated' ? 0.35 : 1 }}>
          {drafting ? 'generating…' : c.status}
        </span>
      </div>

      {/* Farsi */}
      <div className="verse-fa" lang="fa" dir="rtl" style={{ marginBottom: 16 }}>
        {c.farsi.split(' / ').map((h, idx) => <span key={idx}>{h.trim()}</span>)}
      </div>

      <div style={{ height: 1, background: 'var(--c-divider)', margin: '0 0 16px' }} />

      {/* Shahmukhi — word tokens if has translation, skeleton if drafting */}
      <div style={{ minHeight: 48, marginBottom: 12 }}>
        {drafting ? (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {[80, 60, 100, 70].map((w, i) => (
              <div key={i} style={{ height: 28, width: w, borderRadius: 4, background: 'var(--c-divider)', opacity: 0.5 }} />
            ))}
          </div>
        ) : hasTranslation ? (
          <div style={{ direction: 'rtl', textAlign: 'right', lineHeight: 'var(--lh-fa)', display: 'flex', flexWrap: 'wrap', gap: '0 4px', justifyContent: 'flex-end' }}>
            {c.punjabi_final.split(' ').filter(Boolean).map((word, wi) => (
              <button key={wi} onClick={e => onWordClick(word, (e.target as HTMLElement).getBoundingClientRect())}
                style={{
                  fontFamily: 'var(--font-fa)', fontSize: 'var(--fz-fa)', color: 'var(--c-text-en)',
                  background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 3px',
                  borderRadius: 4, transition: 'background 120ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--c-accent-rgb),0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >{word}</button>
            ))}
          </div>
        ) : (
          <p style={{ fontFamily: 'var(--font-fa)', fontSize: 'var(--fz-fa)', color: 'var(--c-text-en)', opacity: 0.25, direction: 'rtl', textAlign: 'right' }}>
            ترجمہ ابھی نہیں ہوا
          </p>
        )}
      </div>

      {/* Roman input */}
      {!approved && (
        <input
          dir="ltr"
          placeholder="Roman Punjabi hints (optional) — press Regenerate to apply"
          value={romanInput}
          onChange={e => onRomanChange(e.target.value)}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 8, marginBottom: 12,
            border: '1px solid var(--c-card-border)', background: 'var(--c-bg)',
            fontFamily: 'var(--font-en-sans)', fontSize: 13, color: 'var(--c-text-fa)',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {!approved && hasTranslation && (
          <button onClick={onRegenerate} disabled={busy}
            style={{
              padding: '8px 16px', borderRadius: 8,
              background: 'transparent', border: '1px solid var(--c-card-border)',
              color: 'var(--c-text-fa)', fontFamily: 'var(--font-en-sans)', fontSize: 12,
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.4 : 0.7,
            }}>
            {regenerating ? '…' : 'Regenerate'}
          </button>
        )}
        <button onClick={onToggleApprove} disabled={busy || !hasTranslation}
          style={{
            padding: '8px 18px', borderRadius: 8,
            background: approved ? 'rgba(0,127,122,0.10)' : 'rgba(var(--c-accent-rgb),0.08)',
            border: `1px solid ${approved ? 'rgba(0,127,122,0.30)' : 'rgba(var(--c-accent-rgb),0.20)'}`,
            color: approved ? '#007F7A' : 'var(--c-accent)',
            fontFamily: 'var(--font-en-sans)', fontSize: 12, fontWeight: 600,
            cursor: busy || !hasTranslation ? 'default' : 'pointer',
            opacity: !hasTranslation ? 0.3 : 1,
          }}>
          {saving ? '…' : approved ? '✓ Approved' : 'Approve'}
        </button>
      </div>
    </div>
  );
}
