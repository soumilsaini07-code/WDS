import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Participant Terminal — Wolf of Dalal Street | ECON Club TIET',
  description:
    'High-performance educational stock trading simulation platform featuring real-time price updates, macro shocks, and virtual portfolio management for the ECON Club at Thapar Institute of Engineering & Technology.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600&family=Nunito+Sans:ital,opsz,wght@0,6..12,300..800;1,6..12,300..800&family=Literata:ital,opsz,wght@0,7..72,400..700;1,7..72,400..700&family=JetBrains+Mono:ital,wght@0,400..700;1,400..700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col font-body">
        {children}
      </body>
    </html>
  );
}
