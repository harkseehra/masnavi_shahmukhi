import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'مثنوی · شاہمکھی',
  description: "Rumi's Masnavi — Farsi and Shahmukhi Punjabi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" data-theme="light" data-font="vazir">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
