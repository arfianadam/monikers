import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const materialSymbolsHref =
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL@20..48,600,0..1' +
  '&icon_names=add,arrow_downward,arrow_forward,arrow_upward,block,check,close,content_copy,expand_more,logout,more_horiz,pause,person_remove,refresh,remove,shield_lock,skip_next,stop_circle,style,sync,timer_off,undo,visibility_off,wifi_off' +
  '&display=block';

export const metadata: Metadata = {
  title: 'Monikers — Party Game Tebak Nama',
  description:
    'Party game cepat dan seru tentang nama terkenal, clue satu kata, dan aksi kocak.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href={materialSymbolsHref} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
