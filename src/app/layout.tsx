import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { Toaster } from 'react-hot-toast';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CreatorPixel — Know exactly who’s watching',
  description: 'Attention is the real currency. See engaged views, watch time, and the real people behind your traffic — websites, landing pages, bio links, and podcasts.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter&family=Playfair+Display&family=Space+Grotesk&family=DM+Sans&family=Bebas+Neue&family=JetBrains+Mono&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={inter.className}>
        {children}
        <Toaster position="bottom-right" />
        {/* Dogfood: CreatorPixel tracking on our own site (injects RB2B as Layer 1) */}
        <Script id="creatorpixel" strategy="afterInteractive">
          {`(function(c,r,e,a,t,o,p){c[t]=c[t]||function(){(c[t].q=c[t].q||[]).push(arguments)};o=r.createElement(e);o.async=1;o.src='/pixel.js';p=r.getElementsByTagName(e)[0];p.parentNode.insertBefore(o,p);})(window,document,'script','','cpx');
cpx('init', '54af35e7-c802-4c3c-ae46-3ff9ae78fbcc', { rb2b: 'GOYPYH44EYOX' });
cpx('track', 'pageview');`}
        </Script>
      </body>
    </html>
  );
}
