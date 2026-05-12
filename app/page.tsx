'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Couplet } from '@/types';

// ── Size tables ──────────────────────────────────────────────────────────────
const SIZE_STEPS = 8;
const SIZE_FA_V  = [20, 22, 24, 26, 28, 30, 32, 34];
const LH_FA_V    = [2.05, 2.05, 2.10, 2.10, 2.15, 2.15, 2.20, 2.20];
const SIZE_FA_L  = [23, 25, 28, 30, 32, 35, 38, 41];
const LH_FA_L    = [2.00, 2.00, 2.05, 2.05, 2.10, 2.15, 2.20, 2.20];

type Theme       = 'light' | 'dark' | 'kaghaz';
type Font        = 'nastaliq' | 'arabic' | 'nazanin' | 'vazir';
type PaFont      = 'nastaleeq' | 'naskh';
type FaColor     = 'irozumi' | 'nila' | 'qahwa' | 'sorkh';
type LangDisplay = 'both' | 'farsi' | 'punjabi';
type Mode        = 'focus' | 'scholar';

interface Bookmark {
  id: string;
  coupletNum: number;
  fa: string;
  pa: string;
  savedAt: number;
}

const LS = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
  getBookmarks: (): Bookmark[] => {
    try { return JSON.parse(localStorage.getItem('mv-bookmarks') || '[]'); } catch { return []; }
  },
  setBookmarks: (bms: Bookmark[]) => {
    try { localStorage.setItem('mv-bookmarks', JSON.stringify(bms)); } catch {}
  },
};

function applyTheme(t: Theme, save = true) {
  if (typeof document !== 'undefined' && document.startViewTransition) {
    document.startViewTransition(() => { document.documentElement.dataset.theme = t; });
  } else if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = t;
  }
  if (save) LS.set('ms-theme', t);
}
function applyFont(f: Font, save = true) {
  document.documentElement.dataset.font = f;
  if (save) LS.set('ms-font', f);
}
function applyPaFont(f: PaFont, save = true) {
  document.documentElement.dataset.paFont = f;
  if (save) LS.set('ms-pa-font', f);
}
function applyFaColor(c: FaColor, save = true) {
  document.documentElement.dataset.faColor = c;
  if (save) LS.set('ms-fa-color', c);
}
function applyLang(v: LangDisplay, save = true) {
  document.documentElement.dataset.langDisplay = v;
  if (save) LS.set('ms-lang', v);
}
function applySizes(font: Font, step: number, save = true) {
  const isNazanin = font === 'nazanin';
  const fzFa = isNazanin ? SIZE_FA_L[step] : SIZE_FA_V[step];
  const lhFa = isNazanin ? LH_FA_L[step]  : LH_FA_V[step];
  document.documentElement.style.setProperty('--fz-fa', fzFa + 'px');
  document.documentElement.style.setProperty('--lh-fa', String(lhFa));
  if (save) LS.set('ms-size', String(step));
}

function buildPages(entries: Couplet[], perPage: number): Couplet[][] {
  const pages: Couplet[][] = [];
  for (let i = 0; i < entries.length; i += perPage) pages.push(entries.slice(i, i + perPage));
  return pages;
}

export default function Reader() {
  const [couplets,    setCouplets]  = useState<Couplet[]>([]);
  const [page,        setPage]      = useState(0);
  const [perPage,     setPerPage]   = useState(10);
  const [theme,       setTheme]     = useState<Theme>('light');
  const [font,        setFont]      = useState<Font>('nastaliq');
  const [paFont,      setPaFont]    = useState<PaFont>('nastaleeq');
  const [faColor,     setFaColor]   = useState<FaColor>('irozumi');
  const [lang,        setLang]      = useState<LangDisplay>('both');
  const [mode,        setMode]      = useState<Mode>('focus');
  const [sizeStep,    setSizeStep]  = useState(3);
  const [dir,         setDir]       = useState<'next' | 'prev' | null>(null);
  const [settingsOpen, setSettings] = useState(false);
  const [tocOpen,     setTocOpen]   = useState(false);
  const [bmOpen,      setBmOpen]    = useState(false);
  const [searchOpen,  setSearch]    = useState(false);
  const [bookmarks,   setBookmarks] = useState<Bookmark[]>([]);
  const [searchVal,   setSearchVal] = useState('');
  const [progress,    setProgress]  = useState(0);

  const focusRef  = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const pages      = buildPages(couplets, perPage);
  const totalPages = pages.length;
  const slice      = pages[page] ?? [];

  // ── Boot ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/book_4.json`)
      .then(r => r.json())
      .then((data: Couplet[]) => setCouplets(data.filter(c => c.status === 'approved')))
      .catch(console.error);

    const t  = (LS.get('ms-theme')   as Theme       | null) ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const f  = (LS.get('ms-font')    as Font        | null) ?? 'nastaliq';
    const pf = (LS.get('ms-pa-font') as PaFont      | null) ?? 'nastaleeq';
    const c  = (LS.get('ms-fa-color') as FaColor    | null) ?? 'irozumi';
    const raw = LS.get('ms-size');
    const s  = raw !== null ? Math.max(0, Math.min(SIZE_STEPS - 1, parseInt(raw))) : 3;
    const pp = LS.get('ms-per-page') ? +LS.get('ms-per-page')! : 10;
    const lg = (LS.get('ms-lang')    as LangDisplay | null) ?? 'both';
    const pgRaw = LS.get('ms-page');
    const pg = pgRaw ? parseInt(pgRaw) : 0;

    setTheme(t);    applyTheme(t, false);
    setFont(f);     applyFont(f, false);
    setPaFont(pf);  applyPaFont(pf, false);
    setFaColor(c);  applyFaColor(c, false);
    setSizeStep(s); applySizes(f, s, false);
    setPerPage(pp);
    setLang(lg);    applyLang(lg, false);
    if (!isNaN(pg) && pg > 0) setPage(pg);
    setBookmarks(LS.getBookmarks());
    document.documentElement.dataset.mode = 'focus';
    if (window.innerWidth <= 600) setMode('focus');
  }, []);

  useEffect(() => { document.documentElement.dataset.mode = mode; }, [mode]);

  // Progress bar (focus scroll)
  useEffect(() => {
    const el = focusRef.current;
    if (!el) return;
    const fn = () => {
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? (el.scrollTop / max) * 100 : 0);
    };
    el.addEventListener('scroll', fn, { passive: true });
    return () => el.removeEventListener('scroll', fn);
  }, [mode, page]);

  // Resize → force focus on mobile
  useEffect(() => {
    const fn = () => { if (window.innerWidth <= 600 && mode === 'scholar') setMode('focus'); };
    window.addEventListener('resize', fn, { passive: true });
    return () => window.removeEventListener('resize', fn);
  }, [mode]);

  // Keyboard shortcuts
  const goToRef = useRef<(target: number, d: number) => void>(() => {});
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' && mode === 'focus') goToRef.current(page + 1,  1);
      if (e.key === 'ArrowLeft'  && mode === 'focus') goToRef.current(page - 1, -1);
      if (e.key === 'Escape') { setSettings(false); setTocOpen(false); setBmOpen(false); setSearch(false); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearch(true); setTimeout(() => searchRef.current?.focus(), 50); }
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [mode, page]);

  // Close settings on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('#settings-panel') && !t.closest('#btn-settings')) setSettings(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goTo = useCallback((target: number, d: number) => {
    if (target < 0 || target >= totalPages) return;
    setDir(d > 0 ? 'next' : d < 0 ? 'prev' : null);
    setPage(target);
    LS.set('ms-page', String(target));
    if (mode === 'scholar') window.scrollTo(0, 0);
    else if (focusRef.current) focusRef.current.scrollTop = 0;
  }, [totalPages, mode]);
  goToRef.current = goTo;

  // ── Settings ──────────────────────────────────────────────────────────────
  const onTheme   = (t: Theme)       => { setTheme(t);   applyTheme(t); };
  const onFont    = (f: Font)        => { setFont(f);    applyFont(f);  applySizes(f, sizeStep); };
  const onPaFont  = (f: PaFont)      => { setPaFont(f);  applyPaFont(f); };
  const onFaColor = (c: FaColor)     => { setFaColor(c); applyFaColor(c); };
  const onLang    = (v: LangDisplay) => { setLang(v);    applyLang(v); };
  const onPerPage = (n: number)      => { setPerPage(n); LS.set('ms-per-page', String(n)); setPage(0); };
  const sizeUp    = () => { const s = Math.min(SIZE_STEPS - 1, sizeStep + 1); setSizeStep(s); applySizes(font, s); };
  const sizeDown  = () => { const s = Math.max(0, sizeStep - 1);              setSizeStep(s); applySizes(font, s); };
  const onMode    = () => { if (window.innerWidth > 600) setMode(m => m === 'focus' ? 'scholar' : 'focus'); };

  // ── Bookmarks ─────────────────────────────────────────────────────────────
  const isBookmarked = (id: string) => bookmarks.some(b => b.id === id);

  const toggleBookmark = (c: Couplet) => {
    const bms = LS.getBookmarks();
    const i = bms.findIndex(b => b.id === c.id);
    if (i >= 0) bms.splice(i, 1);
    else bms.unshift({ id: c.id, coupletNum: c.couplet_number, fa: c.farsi.split(' / ')[0].trim(), pa: (c.punjabi_final || '').slice(0, 60), savedAt: Date.now() });
    LS.setBookmarks(bms);
    setBookmarks([...bms]);
  };

  const jumpToBookmark = (b: Bookmark) => {
    const pg = pages.findIndex(p => p.some(c => c.id === b.id));
    if (pg >= 0) { goTo(pg, 0); setBmOpen(false); }
  };

  const deleteBookmark = (id: string) => {
    const bms = LS.getBookmarks().filter(b => b.id !== id);
    LS.setBookmarks(bms);
    setBookmarks(bms);
  };

  // ── Search ────────────────────────────────────────────────────────────────
  const searchResult = (() => {
    const n = parseInt(searchVal.trim(), 10);
    if (!n || n < 1) return null;
    return couplets.find(c => c.couplet_number === n) ?? null;
  })();

  const jumpToSearch = (c: Couplet) => {
    const pg = pages.findIndex(p => p.some(x => x.id === c.id));
    if (pg >= 0) { goTo(pg, 0); setSearch(false); setSearchVal(''); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div id="progress-bar" role="progressbar" aria-hidden="true"
        style={{ width: mode === 'focus' ? `${progress}%` : totalPages > 1 ? `${((page + 1) / totalPages) * 100}%` : '0%' }} />

      {/* ── Nav ── */}
      <nav id="top-nav" aria-label="Main navigation">
        <a id="site-logo" href="#" aria-label="Table of contents"
          onClick={e => { e.preventDefault(); setTocOpen(o => !o); }}>
          <svg className="logo-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="8" y1="7"  x2="16" y2="7"  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="8" y1="11" x2="16" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="8" y1="15" x2="13" y2="15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span lang="fa" dir="rtl" className="logo-fa">مثنوی</span>
        </a>

        <span id="nav-book-pill">دفتر چهارم</span>

        <div id="nav-actions">
          <button id="btn-bookmarks" className="nav-btn" aria-label="Bookmarks" aria-expanded={bmOpen}
            onClick={() => setBmOpen(o => !o)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 2h10a1 1 0 0 1 1 1v11l-6-3.5L2 14V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            </svg>
          </button>
          <button id="btn-search" className="nav-btn" aria-label="Search"
            onClick={() => { setSearch(true); setTimeout(() => searchRef.current?.focus(), 50); }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4"/>
              <line x1="10.5" y1="10.5" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
          <button id="btn-settings" className="nav-btn nav-btn--text" aria-label="Display options"
            aria-expanded={settingsOpen} onClick={() => setSettings(o => !o)}>Aa</button>
          <button id="btn-mode" className="nav-btn" aria-label="Toggle view" onClick={onMode}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1" y="2" width="5.5" height="12" rx="1" stroke="currentColor" strokeWidth="1.4"/>
              <rect x="9.5" y="2" width="5.5" height="12" rx="1" stroke="currentColor" strokeWidth="1.4"/>
            </svg>
          </button>
        </div>
      </nav>

      {/* ── Settings panel ── */}
      {settingsOpen && (
        <div id="settings-panel" className="open" role="dialog" aria-label="Display options">
          <div className="settings-section">
            <p className="settings-label">Show</p>
            <div className="settings-row">
              {(['both','farsi','punjabi'] as LangDisplay[]).map(v => (
                <button key={v} className={`settings-opt${lang === v ? ' active' : ''}`} onClick={() => onLang(v)}>
                  {v === 'both' ? 'Both' : v === 'farsi' ? 'Farsi' : 'Punjabi'}
                </button>
              ))}
            </div>
          </div>
          <div className="settings-section">
            <p className="settings-label">Couplets per page</p>
            <div className="settings-row">
              {[10, 25, 50].map(n => (
                <button key={n} className={`settings-opt${perPage === n ? ' active' : ''}`} onClick={() => onPerPage(n)}>{n}</button>
              ))}
            </div>
          </div>
          <div className="settings-divider" />
          <div className="settings-section">
            <p className="settings-label">Farsi Script</p>
            <div className="settings-row grid-2">
              {([['nastaliq','Nastaleeq'],['arabic','Naskh'],['nazanin','Nazanin'],['vazir','Vazir']] as [Font,string][]).map(([f,label]) => (
                <button key={f} className={`settings-opt${font === f ? ' active' : ''}`} onClick={() => onFont(f)}>{label}</button>
              ))}
            </div>
          </div>
          <div className="settings-section">
            <p className="settings-label">Farsi Colour</p>
            <div className="settings-row">
              {([['irozumi','Ink','#3C3D3E','#E0E1E0'],['nila','Lapis','#2C3A8C','#7EA8E8'],['qahwa','Coffee','#6F4E37','#C4956A'],['sorkh','Red','#CC3333','#E07878']] as [FaColor,string,string,string][]).map(([c,label,sw,swD]) => (
                <button key={c} className={`settings-opt color-swatch${faColor === c ? ' active' : ''}`}
                  aria-label={label} onClick={() => onFaColor(c)}>
                  <span className="swatch-dot" style={{'--sw': sw, '--sw-dark': swD} as React.CSSProperties} />
                </button>
              ))}
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
        </div>
      )}

      {/* ── Theme pill ── */}
      <div id="theme-pill">
        <button id="btn-theme-toggle" aria-label="Cycle theme"
          onClick={() => onTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'kaghaz' : 'light')}>
          <svg className="icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6"/>
            <line x1="12" y1="2"  x2="12" y2="5"  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <line x1="2"  y1="12" x2="5"  y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <line x1="19" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <line x1="4.93" y1="4.93"   x2="7.05" y2="7.05"   stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <line x1="16.95" y1="16.95" x2="19.07" y2="19.07" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <line x1="4.93" y1="19.07"  x2="7.05" y2="16.95"  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <line x1="16.95" y1="7.05"  x2="19.07" y2="4.93"  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <svg className="icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <svg className="icon-kaghaz" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 2h9l4 4v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
            <polyline points="15 2 15 7 19 7" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            <line x1="9" y1="11" x2="15" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="9" y1="15" x2="15" y2="15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* ── Size pill ── */}
      <div id="size-pill">
        <button id="size-up"   aria-label="Increase text size" disabled={sizeStep >= SIZE_STEPS - 1} onClick={sizeUp}>A</button>
        <div className="size-divider" />
        <button id="size-down" aria-label="Decrease text size" disabled={sizeStep <= 0}              onClick={sizeDown}>a</button>
      </div>

      {/* ── Search ── */}
      {searchOpen && <div id="search-overlay" className="open" onClick={() => { setSearch(false); setSearchVal(''); }} />}
      <div id="search-panel" className={searchOpen ? 'open' : ''} aria-hidden={!searchOpen} role="dialog" aria-label="Search">
        <div id="search-header">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="10.5" y1="10.5" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input ref={searchRef} id="search-input" type="text" inputMode="numeric"
            placeholder="Go to verse…" autoComplete="off" spellCheck={false}
            value={searchVal} onChange={e => setSearchVal(e.target.value)}
            aria-label="Go to verse number" />
        </div>
        <div id="search-results" role="list">
          {searchVal.trim() && !searchResult && (
            <div className="search-empty">Verse {searchVal.trim()} not found in Book 4</div>
          )}
          {searchResult && (
            <div className="search-result-item" role="listitem" style={{cursor:'pointer'}} onClick={() => jumpToSearch(searchResult)}>
              <div className="search-result-num">Verse {searchResult.couplet_number}</div>
              <div className="search-result-fa">{searchResult.farsi}</div>
              {searchResult.punjabi_final && <div className="search-result-en">{searchResult.punjabi_final}</div>}
            </div>
          )}
        </div>
      </div>

      {/* ── Bookmark panel ── */}
      {bmOpen && <div id="bookmark-backdrop" className="visible" onClick={() => setBmOpen(false)} />}
      <aside id="bookmark-panel" className={bmOpen ? 'open' : ''} aria-hidden={!bmOpen} aria-label="Bookmarks">
        <div id="bookmark-header"><p id="bookmark-title">Bookmarks</p></div>
        <div id="bookmark-list" role="list">
          {bookmarks.length === 0
            ? <p className="bm-empty">No bookmarks yet.</p>
            : bookmarks.map(b => (
                <div key={b.id} className="bm-item" role="listitem">
                  <button className="bm-body" onClick={() => jumpToBookmark(b)}>
                    <span className="bm-book-label">Book 4</span>
                    <span className="bm-fa" lang="fa" dir="rtl">{b.fa}</span>
                    <span className="bm-en">{b.pa}</span>
                  </button>
                  <button className="bm-delete" aria-label="Remove bookmark" onClick={() => deleteBookmark(b.id)}>×</button>
                </div>
              ))
          }
        </div>
      </aside>

      {/* ── TOC panel ── */}
      {tocOpen && <div id="toc-backdrop" className="visible" onClick={() => setTocOpen(false)} />}
      <aside id="toc-panel" className={tocOpen ? 'open' : ''} aria-hidden={!tocOpen} aria-label="Table of contents">
        <div id="toc-header">
          <p id="toc-book-label">Book 4</p>
          <p id="toc-title">Table of Contents</p>
        </div>
        <div id="toc-list" role="list">
          <p style={{padding:'20px 24px', opacity:0.4, fontFamily:'var(--font-en-sans)', fontSize:14}}>
            No sections in Book 4.
          </p>
        </div>
      </aside>

      {/* ── Main ── */}
      <main id="main-content">
        {/* Focus view */}
        <div id="focus-view" className="view" aria-hidden={mode !== 'focus' ? true : undefined}>
          <div id="focus-scroll" ref={focusRef} data-dir={dir ?? undefined}>
            {couplets.length === 0 ? (
              <div className="loading-state"><div className="loading-spinner" /><p>Loading…</p></div>
            ) : slice.map((c, i) => (
              <div key={c.id} className="verse-unit" data-index={c.id}
                style={{'--i': i} as React.CSSProperties}>
                <div className="verse-fa-wrap">
                  <div className="verse-fa" lang="fa" dir="rtl">
                    {(c.farsi || '').split(' / ').map((h, j) => <span key={j}>{h.trim()}</span>)}
                  </div>
                  {c.punjabi_final && (
                    <div className="verse-pa">
                      <span className="verse-pa-text">{c.punjabi_final}</span>
                    </div>
                  )}
                </div>
                <span className="verse-num">{c.couplet_number}</span>
                <button className={`bm-btn${isBookmarked(c.id) ? ' bm-active' : ''}`}
                  aria-label={isBookmarked(c.id) ? 'Remove bookmark' : 'Bookmark this verse'}
                  onClick={e => { e.stopPropagation(); toggleBookmark(c); }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 2h10a1 1 0 0 1 1 1v11l-6-3.5L2 14V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Scholar view */}
        <div id="scholar-view" className="view" aria-hidden={mode !== 'scholar' ? true : undefined}>
          <div id="scholar-grid" data-dir={dir ?? undefined}>
            {couplets.length === 0 ? (
              <div className="loading-state"><div className="loading-spinner" /></div>
            ) : slice.map((c, i) => (
              <div key={c.id} className="scholar-row" data-index={c.id}
                style={{'--i': i} as React.CSSProperties}>
                <div className="scholar-cell scholar-cell--shahmukhi">
                  <span className="scholar-num">{c.couplet_number}</span>
                  {c.punjabi_final}
                </div>
                <div className="scholar-cell scholar-cell--fa" lang="fa" dir="rtl">
                  {(c.farsi || '').split(' / ').map((h, j) => <span key={j} style={{display:'block'}}>{h.trim()}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pager */}
        <nav id="pager" aria-label="Page navigation" hidden={totalPages <= 1}>
          <button id="pager-prev" aria-label="Previous page" disabled={page === 0}
            onClick={() => goTo(page - 1, -1)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span id="pager-info">{page + 1} / {totalPages}</span>
          <button id="pager-next" aria-label="Next page" disabled={page === totalPages - 1}
            onClick={() => goTo(page + 1, 1)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M5 2L10 7L5 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </nav>
      </main>
    </>
  );
}
