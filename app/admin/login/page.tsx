'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push('/admin');
    } else {
      setError('Wrong password.');
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--c-bg)',
    }}>
      <div className="verse-unit" style={{ width: 320 }}>
        <p style={{
          fontFamily: 'var(--font-fa)', fontSize: '1.4rem', direction: 'rtl',
          textAlign: 'right', color: 'var(--c-text-fa)', marginBottom: 20,
        }}>
          کارگاہ ترجمہ
        </p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            style={{
              padding: '10px 14px', borderRadius: 8,
              border: '1px solid var(--c-card-border)',
              background: 'var(--c-bg)', color: 'var(--c-text-fa)',
              fontFamily: 'var(--font-en-sans)', fontSize: 14,
              outline: 'none', width: '100%', boxSizing: 'border-box',
            }}
          />
          {error && (
            <p style={{ fontSize: 12, color: '#CC3333', margin: 0 }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            style={{
              padding: '10px', borderRadius: 8,
              background: 'var(--c-accent)', color: '#fff',
              fontFamily: 'var(--font-en-sans)', fontSize: 14, fontWeight: 600,
              opacity: loading || !password ? 0.5 : 1, cursor: loading || !password ? 'default' : 'pointer',
            }}
          >
            {loading ? 'Entering…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
