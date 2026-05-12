'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Couplet } from '@/types';

const PER_PAGE = 25;

const SIZE_STEPS = 6;
const SIZE_FA = [20, 22, 24, 26, 28, 32];
const LH_FA   = [2.05, 2.10, 2.15, 2.15, 2.20, 2.25];

type Theme  = 'light' | 'dark' | 'kaghaz';
type Font   = 'nastaliq' | 'arabic' | 'nazanin';
type PaFont = 'nastaleeq' | 'naskh';

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('ms-theme', theme);
}
function applyFont(font: Font) {
  document.documentElement.dataset.font = font;
  localStorage.setItem('ms-font', font);
}
function applyPaFont(font: PaFont) {
  document.documentElement.dataset.paFont = font;
  localStorage.setItem('ms-pa-font', font);
}
function applySize(step: number) {
  const r = document.documentElement.style;
  r.setProperty('--fz-fa', SIZE_FA[step] + 'px');
  r.setProperty('--lh-fa', String(LH_FA[step]));
  localStorage.setItem('ms-size', String(step));
}

export default function Reader() {
  const [couplets, setCouplets]     = useState<Couplet[]>([]);
  const [page, setPage]             = useState(0);
  const [theme, setTheme]           = useState<Theme>('light');
  const [font, setFont]             = useState<Font>('nastaliq');
  const [paFont, setPaFont]         = useState<PaFont>('nastaleeq');
  const [sizeStep, setSizeStep]     = useState(2);
  const [settingsOpen, setSettings] = useState(false);
  const [dir, setDir]               = useState<'next' | 'prev' | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.ceil(couplets.length / PER_PAGE);
  const slice = couplets.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  useEffect(() => {
    fetch('/book_4.json')
      .then(r => r.json())
      .then((data: Couplet[]) => {
        const approved = data.filter(c => c.status === 'approved');
        setCouplets(approved);
      });

    const t  = localStorage.getItem('ms-theme')   as Theme  | null;
    const f  = localStorage.getItem('ms-font')    as Font   | null;
    const pf = localStorage.getItem('ms-pa-font') as PaFont | null;
    const s  = localStorage.getItem('ms-size');
    const pg = localStorage.getItem('ms-page');

    if (t)  { setTheme(t);   document.documentElement.dataset.theme  = t; }
    if (f)  { setFont(f);    document.documentElement.dataset.font   = f; }
    else    { document.documentElement.dataset.font = 'nastaliq'; }
    if (pf) { setPaFont(pf); document.documentElement.dataset.paFont = pf; }
    else    { document.documentElement.dataset.paFont = 'nastaleeq'; }
    if (s)  { const n = parseInt(s); setSizeStep(n); applySize(n); }
    else    { applySize(2); }
    if (pg) { setPage(parseInt(pg)); }
  }, []);

  const goTo = useCallback((target: number, d: 'next' | 'prev' | null) => {
    if (target < 0 || target >= totalPages) return;
    setDir(d);
    setPage(target);
    window.scrollTo(0, 0);
    localStorage.setItem('ms-page', String(target));
  }, [totalPages]);

  const onTheme  = (t: Theme)  => { setTheme(t);   applyTheme(t); };
  const onFont   = (f: Font)   => { setFont(f);    applyFont(f); };
  const onPaFont = (f: PaFont) => { setPaFont(f);  applyPaFont(f); };
  const onSize   = (delta: number) => {
    const next = Math.min(SIZE_STEPS - 1, Math.max(0, sizeStep + delta));
    setSizeStep(next);
    applySize(next);
  };

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const panel = document.getElementById('settings-panel');
      const btn   = document.getElementById('btn-settings');
      if (panel && !panel.contains(e.target as Node) && e.target !== btn) {
        setSettings(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <>
      <div id="progress-bar" style={{ width: totalPages > 1 ? `${((page + 1) / totalPages) * 100}%` : '0%' }} />

      <nav id="top-nav" aria-label="Main navigation">
        <div id="site-logo">
          <span className="logo-fa">مثنوی</span>
        </div>

        <span id="nav-book-pill">دفتر چهارم</span>

        <div id="nav-actions">
          <button
            id="btn-theme-toggle"
            className="nav-btn"
            aria-label="Toggle theme"
            onClick={() => onTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'kaghaz' : 'light')}
          >
            <span className="icon-sun" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            </span>
            <span className="icon-moon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            </span>
            <span className="icon-kaghaz" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </span>
          </button>

          <button
            id="btn-settings"
            className="nav-btn"
            aria-label="Settings"
            aria-expanded={settingsOpen}
            onClick={() => setSettings(s => !s)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
      </nav>

      {settingsOpen && (
        <div id="settings-panel" className="open">
          <div className="settings-section">
            <p className="settings-label">Theme</p>
            <div className="settings-row">
              {(['light', 'dark', 'kaghaz'] as Theme[]).map(t => (
                <button key={t} className={`settings-opt${theme === t ? ' active' : ''}`} onClick={() => onTheme(t)}>
                  {t === 'kaghaz' ? 'Kaghaz' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-divider" />

          <div className="settings-section">
            <p className="settings-label">Farsi Script</p>
            <div className="settings-row">
              <button className={`settings-opt${font === 'nastaliq' ? ' active' : ''}`} onClick={() => onFont('nastaliq')}>Nastaleeq</button>
              <button className={`settings-opt${font === 'arabic'   ? ' active' : ''}`} onClick={() => onFont('arabic')}>Naskh</button>
              <button className={`settings-opt${font === 'nazanin'  ? ' active' : ''}`} onClick={() => onFont('nazanin')}>Nazanin</button>
            </div>
          </div>

          <div className="settings-divider" />

          <div className="settings-section">
            <p className="settings-label">Punjabi Script</p>
            <div className="settings-row">
              <button className={`settings-opt${paFont === 'nastaleeq' ? ' active' : ''}`} onClick={() => onPaFont('nastaleeq')}>Nastaleeq</button>
              <button className={`settings-opt${paFont === 'naskh'     ? ' active' : ''}`} onClick={() => onPaFont('naskh')}>Naskh</button>
            </div>
          </div>

          <div className="settings-divider" />

          <div className="settings-section">
            <p className="settings-label">Text size</p>
            <div className="settings-row" style={{ alignItems: 'center', gap: 8 }}>
              <button className="nav-btn" style={{ opacity: sizeStep <= 0 ? 0.2 : 0.6, fontSize: 13 }} disabled={sizeStep <= 0} onClick={() => onSize(-1)}>A−</button>
              <button className="nav-btn" style={{ opacity: sizeStep >= SIZE_STEPS - 1 ? 0.2 : 0.6, fontSize: 18 }} disabled={sizeStep >= SIZE_STEPS - 1} onClick={() => onSize(1)}>A+</button>
            </div>
          </div>
        </div>
      )}

      <div id="main-content" data-mode="scholar">
        <div id="scholar-view" style={{ display: 'block' }}>
          {couplets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 24px', fontFamily: 'var(--font-en-sans)', fontSize: 14, opacity: 0.4 }}>
              No approved translations yet.
            </div>
          ) : (
            <div
              id="scholar-grid"
              ref={gridRef}
              data-dir={dir ?? undefined}
            >
              {slice.map((c, i) => (
                <div
                  key={c.id}
                  className="scholar-row"
                  data-index={c.id}
                  style={{ ['--i' as string]: i }}
                >
                  <div className="scholar-cell scholar-cell--shahmukhi">
                    <span className="scholar-num">{c.couplet_number}</span>
                    {c.punjabi_final}
                  </div>
                  <div className="scholar-cell scholar-cell--fa">
                    <span lang="fa" dir="rtl">{c.farsi}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div id="pager">
          <button id="pager-prev" onClick={() => goTo(page - 1, 'prev')} disabled={page === 0} aria-label="Previous page">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span id="pager-info">{page + 1} / {totalPages}</span>
          <button id="pager-next" onClick={() => goTo(page + 1, 'next')} disabled={page === totalPages - 1} aria-label="Next page">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      )}
    </>
  );
}
