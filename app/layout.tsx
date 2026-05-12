import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'مثنوی · شاہمکھی',
  description: "Rumi's Masnavi — Farsi and Shahmukhi Punjabi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" data-font="nastaliq" data-en-font="sans"
      data-fa-color="irozumi" data-mode="focus">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700&family=Schibsted+Grotesk:ital,wght@0,400;0,500;0,600;1,400&family=Amiri:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
