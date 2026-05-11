'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Couplet, CoupletStatus } from '@/types';

const BATCH_SIZES = [10, 25, 50] as const;
type BatchSize = typeof BATCH_SIZES[number];

type AdminFont = 'vazir' | 'nazanin' | 'nastaliq';

function applyFont(f: AdminFont) {
  document.documentElement.dataset.font = f;
  localStorage.setItem('ms-admin-font', f);
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

  const load = useCallback(async (off: number, size: BatchSize) => {
    setLoading(true);
    const res  = await fetch(`/api/admin/couplets?offset=${off}&size=${size}`);
    const data = await res.json();
    setCouplets(data.couplets);
    setTotal(data.total);
    setLoading(false);
  }, []);

  useEffect(() => {
    const f = localStorage.getItem('ms-admin-font') as AdminFont | null;
    if (f) { setFont(f); applyFont(f); }
    load(0, 25);
  }, [load]);

  async function toggleApprove(c: Couplet) {
    const next: CoupletStatus = c.status === 'approved' ? 'untranslated' : 'approved';
    setSaving(s => new Set(s).add(c.id));
    const res = await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, status: next }),
    });
    const updated: Couplet = await res.json();
    setCouplets(cs => cs.map(x => x.id === updated.id ? updated : x));
    setSaving(s => { const n = new Set(s); n.delete(c.id); return n; });
  }

  function changeBatch(size: BatchSize) {
    setBatchSize(size);
    setOffset(0);
    load(0, size);
  }

  function jump() {
    const n = parseInt(jumpVal);
    if (isNaN(n) || n < 1 || n > total) return;
    const off = Math.max(0, Math.floor((n - 1) / batchSize) * batchSize);
    setOffset(off);
    load(off, batchSize);
    setJumpVal('');
  }

  function prev() { const off = Math.max(0, offset - batchSize); setOffset(off); load(off, batchSize); }
  function next() { const off = offset + batchSize; if (off < total) { setOffset(off); load(off, batchSize); } }

  const onFont = (f: AdminFont) => { setFont(f); applyFont(f); };

  const allApproved = couplets.length > 0 && couplets.every(c => c.status === 'approved');
  const from = offset + 1;
  const to   = Math.min(offset + batchSize, total);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--c-bg)' }}>
      {/* Nav */}
      <nav id="top-nav" aria-label="Workbench navigation">
        <div id="site-logo">
          <span className="logo-fa">کارگاہ</span>
        </div>
        <span id="nav-book-pill">دفتر چهارم</span>
        <div id="nav-actions">
          <a href="/" className="nav-btn" style={{ fontSize: 12, opacity: 0.5, textDecoration: 'none' }}>Reader</a>
        </div>
      </nav>

      {/* Controls bar */}
      <div style={{
        position: 'sticky', top: 'calc(var(--nav-h) + var(--progress-h))',
        background: 'var(--c-nav-bg)', borderBottom: '1px solid var(--c-nav-border)',
        zIndex: 500, padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        {/* Batch size */}
        <div style={{ display: 'flex', gap: 4 }}>
          {BATCH_SIZES.map(s => (
            <button
              key={s}
              className={`settings-opt${batchSize === s ? ' active' : ''}`}
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() => changeBatch(s)}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Position */}
        <span style={{ fontFamily: 'var(--font-en-sans)', fontSize: 12, color: 'var(--c-text-fa)', opacity: 0.55 }}>
          {from}–{to} of {total} · Book 4
        </span>

        {/* Jump */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="number"
            placeholder="Jump to #"
            value={jumpVal}
            onChange={e => setJumpVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && jump()}
            style={{
              width: 90, padding: '6px 10px', borderRadius: 8,
              border: '1px solid var(--c-card-border)',
              background: 'var(--c-bg)', color: 'var(--c-text-fa)',
              fontFamily: 'var(--font-en-sans)', fontSize: 12, outline: 'none',
            }}
          />
          <button className="settings-opt" style={{ padding: '6px 12px', fontSize: 12 }} onClick={jump}>Go</button>
        </div>

        {/* Script toggle (placeholder) */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {(['vazir', 'nazanin', 'nastaliq'] as AdminFont[]).map(f => (
            <button
              key={f}
              className={`settings-opt${font === f ? ' active' : ''}`}
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() => onFont(f)}
            >
              {f === 'vazir' ? 'Naskh' : f === 'nazanin' ? 'Nazanin' : 'Nastaliq'}
            </button>
          ))}
        </div>
      </div>

      {/* Couplet cards */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px 140px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div className="loading-state visible"><div className="loading-spinner" /><span>Loading…</span></div>
        ) : couplets.map((c, i) => (
          <CoupletCard
            key={c.id}
            couplet={c}
            index={i}
            saving={saving.has(c.id)}
            onToggle={() => toggleApprove(c)}
          />
        ))}
      </div>

      {/* Bottom controls */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--c-nav-bg)', borderTop: '1px solid var(--c-nav-border)',
        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12,
        zIndex: 400,
      }}>
        <button id="pager-prev" onClick={prev} disabled={offset === 0}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button id="pager-next" onClick={next} disabled={offset + batchSize >= total}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        <button
          disabled={!allApproved}
          onClick={() => alert('Approve batch & publish — wired up in Phase 4')}
          style={{
            marginLeft: 'auto',
            padding: '10px 20px', borderRadius: 10,
            background: allApproved ? 'var(--c-accent)' : 'var(--c-card-border)',
            color: allApproved ? '#fff' : 'var(--c-text-fa)',
            fontFamily: 'var(--font-en-sans)', fontSize: 13, fontWeight: 600,
            opacity: allApproved ? 1 : 0.4,
            cursor: allApproved ? 'pointer' : 'default',
            transition: 'all 220ms',
          }}
        >
          Approve Batch & Push to Reader
        </button>
      </div>
    </div>
  );
}

function CoupletCard({ couplet: c, index: i, saving, onToggle }: {
  couplet: Couplet; index: number; saving: boolean; onToggle: () => void;
}) {
  const approved = c.status === 'approved';
  const hasTranslation = c.punjabi_final.trim().length > 0;

  return (
    <div
      className="verse-unit"
      style={{ ['--i' as string]: i, opacity: saving ? 0.6 : 1, transition: 'opacity 150ms' }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--c-verse-num)', letterSpacing: '0.06em' }}>
          #{c.id}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase',
          color: approved ? '#007F7A' : 'var(--c-text-fa)',
          opacity: approved ? 1 : 0.35,
        }}>
          {c.status}
        </span>
      </div>

      {/* Farsi */}
      <div className="verse-fa" lang="fa" dir="rtl" style={{ marginBottom: 16 }}>
        {c.farsi.split(' / ').map((h, idx) => <span key={idx}>{h.trim()}</span>)}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--c-divider)', margin: '0 0 16px' }} />

      {/* Shahmukhi area */}
      <div style={{
        fontFamily: 'var(--font-fa)', fontSize: 'var(--fz-fa)',
        lineHeight: 'var(--lh-fa)', color: 'var(--c-text-en)',
        direction: 'rtl', textAlign: 'right', minHeight: 48,
        opacity: hasTranslation ? 1 : 0.3,
        marginBottom: 16,
      }}>
        {hasTranslation ? c.punjabi_final : 'ترجمہ ابھی نہیں ہوا — Phase 3 میں AI شامل ہوگا'}
      </div>

      {/* Approve button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onToggle}
          disabled={saving}
          style={{
            padding: '8px 18px', borderRadius: 8,
            background: approved ? 'rgba(0,127,122,0.10)' : 'rgba(var(--c-accent-rgb),0.08)',
            border: `1px solid ${approved ? 'rgba(0,127,122,0.30)' : 'rgba(var(--c-accent-rgb),0.20)'}`,
            color: approved ? '#007F7A' : 'var(--c-accent)',
            fontFamily: 'var(--font-en-sans)', fontSize: 12, fontWeight: 600,
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          {saving ? '…' : approved ? '✓ Approved' : 'Approve'}
        </button>
      </div>
    </div>
  );
}
