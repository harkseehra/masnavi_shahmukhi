'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────
interface VerseEntry  { type: 'verse';   number: number; farsi: string; index: number; }
interface HeadingEntry{ type: 'heading'; title_en?: string; title_fa?: string; index: number; }
type Entry = VerseEntry | HeadingEntry;

// Punjabi translation lookup: verse number → text
type PunjabiMap = Record<number, string>;

// Raw book JSON format
interface BookData { sections: { title_en?: string; title_fa?: string; entries: { number: number; farsi: string }[] }[] }

interface Bookmark { book: number; index: number; fa: string; savedAt: number; }

// ── Size tables (matching original exactly) ──────────────────────────────────
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

const LS = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
  getBookmarks: (): Bookmark[] => { try { return JSON.parse(localStorage.getItem('mv-bookmarks') || '[]'); } catch { return []; } },
  setBookmarks: (b: Bookmark[]) => { try { localStorage.setItem('mv-bookmarks', JSON.stringify(b)); } catch {} },
};

function flattenBook(data: { sections: { title_en?: string; title_fa?: string; entries: { number: number; farsi: string }[] }[] }): Entry[] {
  const out: Entry[] = [];
  let idx = 0;
  for (const section of data.sections) {
    if (section.title_en || section.title_fa)
      out.push({ type: 'heading', title_en: section.title_en, title_fa: section.title_fa, index: idx++ });
    for (const e of section.entries)
      out.push({ type: 'verse', number: e.number, farsi: e.farsi, index: idx++ });
  }
  return out;
}

function buildPages(entries: Entry[], perPage: number): Entry[][] {
  const pages: Entry[][] = [];
  let page: Entry[] = [];
  let count = 0;
  for (const e of entries) {
    page.push(e);
    if (e.type === 'verse') {
      count++;
      if (count === perPage) { pages.push(page); page = []; count = 0; }
    }
  }
  if (page.length) pages.push(page);
  return pages;
}

function applyTheme(t: Theme, save = true) {
  if (document.startViewTransition) document.startViewTransition(() => { document.documentElement.dataset.theme = t; });
  else document.documentElement.dataset.theme = t;
  if (save) LS.set('mv-theme', t);
}
function applyFont(f: Font, save = true)  { document.documentElement.dataset.font    = f; if (save) LS.set('mv-font', f); }
function applyPaFont(f: PaFont, save = true) { document.documentElement.dataset.paFont = f; if (save) LS.set('mv-pa-font', f); }
function applyFaColor(c: FaColor, save = true) { document.documentElement.dataset.faColor = c; if (save) LS.set('mv-fa-color', c); }
function applyLang(v: LangDisplay, save = true) { document.documentElement.dataset.langDisplay = v; if (save) LS.set('mv-lang', v); }

function applySizes(font: Font, step: number, save = true) {
  const isNaz = font === 'nazanin';
  document.documentElement.style.setProperty('--fz-fa', (isNaz ? SIZE_FA_L : SIZE_FA_V)[step] + 'px');
  document.documentElement.style.setProperty('--lh-fa', String((isNaz ? LH_FA_L : LH_FA_V)[step]));
  if (save) LS.set('mv-size-step', String(step));
}

// ── Component ────────────────────────────────────────────────────────────────
export default function Reader() {
  const [entries,    setEntries]   = useState<Entry[]>([]);
  const [punjabi,    setPunjabi]   = useState<PunjabiMap>({});
  const [book,       setBook]      = useState(1);
  const [page,       setPage]      = useState(0);
  const [perPage,    setPerPage]   = useState(10);
  const [theme,      setTheme]     = useState<Theme>('light');
  const [font,       setFont]      = useState<Font>('nastaliq');
  const [paFont,     setPaFont]    = useState<PaFont>('nastaleeq');
  const [faColor,    setFaColor]   = useState<FaColor>('irozumi');
  const [lang,       setLang]      = useState<LangDisplay>('both');
  const [mode,       setMode]      = useState<Mode>('focus');
  const [sizeStep,   setSizeStep]  = useState(3);
  const [dir,        setDir]       = useState<'next' | 'prev' | null>(null);
  const [loading,    setLoading]   = useState(false);
  const [bookmarks,  setBookmarks] = useState<Bookmark[]>([]);
  const [settingsOpen, setSettings]= useState(false);
  const [tocOpen,    setTocOpen]   = useState(false);
  const [bmOpen,     setBmOpen]    = useState(false);
  const [searchOpen, setSearchOpen]= useState(false);
  const [searchVal,  setSearchVal] = useState('');
  const [progress,   setProgress]  = useState(0);
  const [cache,      setCache]     = useState<Record<number, BookData>>({});

  const focusRef   = useRef<HTMLDivElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);

  const pages      = buildPages(entries, perPage);
  const totalPages = pages.length;
  const slice      = pages[page] ?? [];

  // ── Boot ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Restore prefs
    const t  = (LS.get('mv-theme')    as Theme       | null) ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const f  = (LS.get('mv-font')     as Font        | null) ?? 'nastaliq';
    const pf = (LS.get('mv-pa-font')  as PaFont      | null) ?? 'nastaleeq';
    const c  = (LS.get('mv-fa-color') as FaColor     | null) ?? 'irozumi';
    const raw = LS.get('mv-size-step');
    const s  = raw !== null ? Math.max(0, Math.min(SIZE_STEPS - 1, parseInt(raw))) : 3;
    const pp = LS.get('mv-per-page')  ? +LS.get('mv-per-page')!  : 10;
    const lg = (LS.get('mv-lang')     as LangDisplay | null) ?? 'both';
    const lb = LS.get('mv-last-book') ? parseInt(LS.get('mv-last-book')!) : 1;
    const lp = LS.get('mv-last-page') ? parseInt(LS.get('mv-last-page')!) : 0;

    setTheme(t);    applyTheme(t, false);
    setFont(f);     applyFont(f, false);
    setPaFont(pf);  applyPaFont(pf, false);
    setFaColor(c);  applyFaColor(c, false);
    setSizeStep(s); applySizes(f, s, false);
    setPerPage(pp);
    setLang(lg);    applyLang(lg, false);
    setBookmarks(LS.getBookmarks());
    document.documentElement.dataset.mode = 'focus';

    // Load Punjabi translations (book 4 only for now)
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    fetch(`${base}/book_4.json`)
      .then(r => r.json())
      .then((data: { couplet_number: number; punjabi_final: string; status: string }[]) => {
        const map: PunjabiMap = {};
        data.filter(c => c.status === 'approved').forEach(c => { map[c.couplet_number] = c.punjabi_final; });
        setPunjabi(map);
      })
      .catch(() => {});

    switchBook(lb, lp);
  }, []);

  useEffect(() => { document.documentElement.dataset.mode = mode; }, [mode]);

  useEffect(() => {
    const el = focusRef.current;
    if (!el) return;
    const fn = () => { const max = el.scrollHeight - el.clientHeight; setProgress(max > 0 ? (el.scrollTop / max) * 100 : 0); };
    el.addEventListener('scroll', fn, { passive: true });
    return () => el.removeEventListener('scroll', fn);
  }, [mode, page]);

  useEffect(() => {
    const fn = () => { if (window.innerWidth <= 600 && mode === 'scholar') setMode('focus'); };
    window.addEventListener('resize', fn, { passive: true });
    return () => window.removeEventListener('resize', fn);
  }, [mode]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  const goToRef = useRef<(t: number, d: number) => void>(() => {});
  const pageRef = useRef(page);
  const modeRef = useRef(mode);
  pageRef.current = page;
  modeRef.current = mode;

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' && modeRef.current === 'focus') goToRef.current(pageRef.current + 1,  1);
      if (e.key === 'ArrowLeft'  && modeRef.current === 'focus') goToRef.current(pageRef.current - 1, -1);
      if (e.key === 'Escape') { setSettings(false); setTocOpen(false); setBmOpen(false); setSearchOpen(false); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50); }
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('#settings-panel') && !t.closest('#btn-settings')) setSettings(false);
      if (!t.closest('#bookmark-panel')  && !t.closest('#btn-bookmarks'))  setBmOpen(false);
      if (!t.closest('#toc-panel')       && !t.closest('#site-logo'))      setTocOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // ── Book loading ──────────────────────────────────────────────────────────
  const switchBook = useCallback(async (n: number, startPage = 0) => {
    setBook(n);
    setPage(0);
    setLoading(true);

    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    const cached = cache[n];
    const data = cached ?? await fetch(`${base}/data/book${n}.json`).then(r => r.json());
    if (!cached) setCache(prev => ({ ...prev, [n]: data }));

    const flat = flattenBook(data);
    setEntries(flat);
    setLoading(false);

    if (startPage > 0) {
      const pg = buildPages(flat, perPage);
      setPage(Math.min(startPage, pg.length - 1));
    }

    LS.set('mv-last-book', String(n));
  }, [cache, perPage]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goTo = useCallback((target: number, d: number) => {
    const total = buildPages(entries, perPage).length;
    if (target < 0 || target >= total) return;
    setDir(d > 0 ? 'next' : d < 0 ? 'prev' : null);
    setPage(target);
    LS.set('mv-last-book', String(book));
    LS.set('mv-last-page', String(target));
    if (mode === 'scholar') window.scrollTo(0, 0);
    else if (focusRef.current) focusRef.current.scrollTop = 0;
  }, [entries, perPage, book, mode]);
  goToRef.current = goTo;

  // ── Settings handlers ─────────────────────────────────────────────────────
  const onTheme   = (t: Theme)       => { setTheme(t);   applyTheme(t); };
  const onFont    = (f: Font)        => { setFont(f);    applyFont(f);  applySizes(f, sizeStep); };
  const onPaFont  = (f: PaFont)      => { setPaFont(f);  applyPaFont(f); };
  const onFaColor = (c: FaColor)     => { setFaColor(c); applyFaColor(c); };
  const onLang    = (v: LangDisplay) => { setLang(v);    applyLang(v); };
  const onPerPage = (n: number) => {
    setPerPage(n); LS.set('mv-per-page', String(n));
    const newPages = buildPages(entries, n);
    const firstVerse = slice.find(e => e.type === 'verse') as VerseEntry | undefined;
    if (firstVerse) {
      const pg = newPages.findIndex(p => p.some(e => e.type === 'verse' && (e as VerseEntry).number >= firstVerse.number));
      setPage(Math.max(0, pg));
    } else setPage(0);
  };
  const sizeUp   = () => { const s = Math.min(SIZE_STEPS - 1, sizeStep + 1); setSizeStep(s); applySizes(font, s); };
  const sizeDown = () => { const s = Math.max(0, sizeStep - 1);              setSizeStep(s); applySizes(font, s); };
  const onMode   = () => { if (window.innerWidth > 600) setMode(m => m === 'focus' ? 'scholar' : 'focus'); };

  // ── Bookmarks ─────────────────────────────────────────────────────────────
  const isBookmarked = (index: number) => bookmarks.some(b => b.book === book && b.index === index);
  const toggleBookmark = (entry: VerseEntry) => {
    const bms = LS.getBookmarks();
    const i = bms.findIndex(b => b.book === book && b.index === entry.index);
    if (i >= 0) bms.splice(i, 1);
    else bms.unshift({ book, index: entry.index, fa: entry.farsi.split(' / ')[0].trim(), savedAt: Date.now() });
    LS.setBookmarks(bms); setBookmarks([...bms]);
  };
  const jumpToBookmark = (b: Bookmark) => {
    if (b.book !== book) { switchBook(b.book).then(() => { /* jump after load */ }); setBmOpen(false); return; }
    const pg = pages.findIndex(p => p.some(e => e.index === b.index));
    if (pg >= 0) { goTo(pg, 0); setBmOpen(false); }
  };

  // ── Search ────────────────────────────────────────────────────────────────
  const searchResult = (() => {
    const n = parseInt(searchVal.trim(), 10);
    if (!n) return null;
    return entries.find(e => e.type === 'verse' && (e as VerseEntry).number === n) as VerseEntry | null;
  })();
  const jumpToSearch = (e: VerseEntry) => {
    const pg = pages.findIndex(p => p.some(x => x.index === e.index));
    if (pg >= 0) { goTo(pg, 0); setSearchOpen(false); setSearchVal(''); }
  };

  // ── TOC ───────────────────────────────────────────────────────────────────
  const headings = entries.filter(e => e.type === 'heading') as HeadingEntry[];
  const jumpToTOC = (h: HeadingEntry) => {
    const pg = pages.findIndex(p => p.some(e => e.index === h.index));
    if (pg >= 0) { goTo(pg, 0); setTocOpen(false); }
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const paText = (entry: VerseEntry) => book === 4 ? (punjabi[entry.number] ?? null) : null;

  return (
    <>
      <div id="progress-bar" role="progressbar" aria-hidden="true"
        style={{ width: mode === 'focus' ? `${progress}%` : totalPages > 1 ? `${((page + 1) / totalPages) * 100}%` : '0%' }} />

      {/* ── Nav ── */}
      <nav id="top-nav" aria-label="Main navigation">
        <a id="site-logo" href="#" aria-label="Masnavi — table of contents"
          onClick={e => { e.preventDefault(); setTocOpen(o => !o); }}>
          <svg className="logo-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="8" y1="7"  x2="16" y2="7"  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="8" y1="11" x2="16" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="8" y1="15" x2="13" y2="15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <span lang="fa" dir="rtl" className="logo-fa">مثنوی</span>
        </a>

        <div id="book-tabs" role="tablist" aria-label="Select book">
          {[1,2,3,4,5,6].map(n => (
            <button key={n} className={`book-tab${book === n ? ' active' : ''}`} role="tab"
              aria-selected={book === n} onClick={() => switchBook(n)}>
              Book {n}
            </button>
          ))}
        </div>

        <button id="nav-book-pill" aria-label="Select book" onClick={() => {}}>Book {book}</button>

        <div id="nav-actions">
          <button id="btn-bookmarks" className="nav-btn" aria-label="Bookmarks" aria-expanded={bmOpen}
            onClick={() => setBmOpen(o => !o)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 2h10a1 1 0 0 1 1 1v11l-6-3.5L2 14V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            </svg>
          </button>
          <button id="btn-search" className="nav-btn" aria-label="Search"
            onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50); }}>
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
            <line x1="12" y1="2" x2="12" y2="5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <line x1="2" y1="12" x2="5" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <line x1="19" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <line x1="4.93" y1="4.93" x2="7.05" y2="7.05" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <line x1="16.95" y1="16.95" x2="19.07" y2="19.07" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <line x1="4.93" y1="19.07" x2="7.05" y2="16.95" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <line x1="16.95" y1="7.05" x2="19.07" y2="4.93" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
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
        <button id="size-down" aria-label="Decrease text size" disabled={sizeStep <= 0} onClick={sizeDown}>a</button>
      </div>

      {/* ── Search ── */}
      {searchOpen && <div id="search-overlay" className="open" onClick={() => { setSearchOpen(false); setSearchVal(''); }} />}
      <div id="search-panel" className={searchOpen ? 'open' : ''} aria-hidden={!searchOpen} role="dialog">
        <div id="search-header">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="10.5" y1="10.5" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input ref={searchRef} id="search-input" type="text" inputMode="numeric"
            placeholder="Go to verse…" autoComplete="off" spellCheck={false}
            value={searchVal} onChange={e => setSearchVal(e.target.value)} aria-label="Go to verse number" />
        </div>
        <div id="search-results" role="list">
          {searchVal.trim() && !searchResult && (
            <div className="search-empty">Verse {searchVal.trim()} not found in Book {book}</div>
          )}
          {searchResult && (
            <div className="search-result-item" role="listitem" style={{cursor:'pointer'}} onClick={() => jumpToSearch(searchResult)}>
              <div className="search-result-num">Verse {searchResult.number}</div>
              <div className="search-result-fa">{searchResult.farsi}</div>
              {paText(searchResult) && <div className="search-result-en">{paText(searchResult)}</div>}
            </div>
          )}
        </div>
      </div>

      {/* ── Bookmarks ── */}
      {bmOpen && <div id="bookmark-backdrop" className="visible" onClick={() => setBmOpen(false)} />}
      <aside id="bookmark-panel" className={bmOpen ? 'open' : ''} aria-hidden={!bmOpen} aria-label="Bookmarks">
        <div id="bookmark-header"><p id="bookmark-title">Bookmarks</p></div>
        <div id="bookmark-list" role="list">
          {bookmarks.length === 0
            ? <p className="bm-empty">No bookmarks yet.</p>
            : bookmarks.map((b, i) => (
              <div key={i} className="bm-item" role="listitem">
                <button className="bm-body" onClick={() => jumpToBookmark(b)}>
                  <span className="bm-book-label">Book {b.book}</span>
                  <span className="bm-fa" lang="fa" dir="rtl">{b.fa}</span>
                </button>
                <button className="bm-delete" aria-label="Remove bookmark"
                  onClick={() => { const bms = LS.getBookmarks().filter((x,j) => j !== i); LS.setBookmarks(bms); setBookmarks(bms); }}>×</button>
              </div>
            ))
          }
        </div>
      </aside>

      {/* ── TOC ── */}
      {tocOpen && <div id="toc-backdrop" className="visible" onClick={() => setTocOpen(false)} />}
      <aside id="toc-panel" className={tocOpen ? 'open' : ''} aria-hidden={!tocOpen} aria-label="Table of contents">
        <div id="toc-header">
          <p id="toc-book-label">Book {book}</p>
          <p id="toc-title">Table of Contents</p>
        </div>
        <div id="toc-list" role="list">
          {headings.length === 0
            ? <p style={{padding:'20px 24px', opacity:0.4, fontFamily:'var(--font-en-sans)', fontSize:14}}>No sections.</p>
            : headings.map(h => (
              <div key={h.index} className="toc-item" role="listitem" style={{cursor:'pointer'}} onClick={() => jumpToTOC(h)}>
                {h.title_en && <span>{h.title_en}</span>}
                {h.title_fa && <span className="toc-fa" lang="fa" dir="rtl">{h.title_fa}</span>}
              </div>
            ))
          }
        </div>
      </aside>

      {/* ── Main ── */}
      <main id="main-content">
        {/* Focus view */}
        <div id="focus-view" className="view" aria-hidden={mode !== 'focus' ? true : undefined}>
          <div id="focus-scroll" ref={focusRef} data-dir={dir ?? undefined}>
            {loading ? (
              <div className="loading-state"><div className="loading-spinner" /><p>Loading…</p></div>
            ) : slice.map((entry, i) => {
              if (entry.type === 'heading') return (
                <div key={entry.index} className="verse-unit type-heading" data-index={entry.index}
                  style={{'--i': i} as React.CSSProperties}>
                  {entry.title_en && <p className="heading-en">{entry.title_en}</p>}
                  {entry.title_fa && <p className="heading-fa" lang="fa" dir="rtl">{entry.title_fa}</p>}
                </div>
              );
              const v = entry as VerseEntry;
              const pa = paText(v);
              return (
                <div key={v.index} className="verse-unit" data-index={v.index}
                  style={{'--i': i} as React.CSSProperties}>
                  <div className="verse-fa-wrap">
                    <div className="verse-fa" lang="fa" dir="rtl">
                      {(v.farsi || '').split(' / ').map((h, j) => <span key={j}>{h.trim()}</span>)}
                    </div>
                    {pa && (
                      <div className="verse-pa">
                        <span className="verse-pa-text">{pa}</span>
                      </div>
                    )}
                  </div>
                  <span className="verse-num">{v.number}</span>
                  <button className={`bm-btn${isBookmarked(v.index) ? ' bm-active' : ''}`}
                    aria-label={isBookmarked(v.index) ? 'Remove bookmark' : 'Bookmark'}
                    onClick={e => { e.stopPropagation(); toggleBookmark(v); }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M3 2h10a1 1 0 0 1 1 1v11l-6-3.5L2 14V3a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
          {loading && <div id="focus-loading" className="loading-state visible"><div className="loading-spinner" /><p>Loading…</p></div>}
        </div>

        {/* Scholar view */}
        <div id="scholar-view" className="view" aria-hidden={mode !== 'scholar' ? true : undefined}>
          <div id="scholar-grid" data-dir={dir ?? undefined}>
            {loading ? (
              <div className="loading-state"><div className="loading-spinner" /></div>
            ) : slice.map((entry, i) => {
              if (entry.type === 'heading') return (
                <div key={entry.index} className="scholar-row scholar-heading" data-index={entry.index}
                  style={{'--i': i} as React.CSSProperties}>
                  <div className="scholar-cell scholar-cell--shahmukhi">{entry.title_fa ?? ''}</div>
                  <div className="scholar-cell scholar-cell--fa" lang="fa" dir="rtl">{entry.title_fa ?? ''}</div>
                </div>
              );
              const v = entry as VerseEntry;
              const pa = paText(v);
              return (
                <div key={v.index} className="scholar-row" data-index={v.index}
                  style={{'--i': i} as React.CSSProperties}>
                  <div className="scholar-cell scholar-cell--shahmukhi">
                    {pa ?? ''}
                    <span className="scholar-num">{v.number}</span>
                  </div>
                  <div className="scholar-cell scholar-cell--fa" lang="fa" dir="rtl">
                    {(v.farsi || '').split(' / ').map((h, j) => <span key={j} style={{display:'block'}}>{h.trim()}</span>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pager */}
        <nav id="pager" aria-label="Page navigation" hidden={totalPages <= 1}>
          <button id="pager-prev" aria-label="Previous page" disabled={page === 0} onClick={() => goTo(page - 1, -1)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span id="pager-info">{page + 1} / {totalPages}</span>
          <button id="pager-next" aria-label="Next page" disabled={page === totalPages - 1} onClick={() => goTo(page + 1, 1)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M5 2L10 7L5 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </nav>
      </main>
    </>
  );
}
