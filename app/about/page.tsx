export default function About() {
  return (
    <div style={{ maxWidth: 640, margin: '80px auto', padding: '0 24px', fontFamily: 'var(--font-en-sans)' }}>
      <p style={{ fontFamily: 'var(--font-fa)', fontSize: '2rem', direction: 'rtl', textAlign: 'right', color: 'var(--c-text-fa)', marginBottom: 4 }}>
        مثنوی معنوی
      </p>
      <p style={{ fontSize: '1rem', color: 'var(--c-text-en)', opacity: 0.7, marginBottom: 48 }}>
        Masnavi · Shahmukhi Punjabi
      </p>
      <div style={{
        background: 'var(--c-card-bg)',
        border: '1px solid var(--c-card-border)',
        borderRadius: 12,
        padding: '32px 24px',
        textAlign: 'center',
        color: 'var(--c-text-en)',
        opacity: 0.6,
      }}>
        ✦ Coming soon
        <p style={{ marginTop: 8, fontSize: '0.85rem' }}>
          This page will share the story behind the project and the person who built it.
        </p>
      </div>
    </div>
  );
}
