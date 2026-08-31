import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { Toaster } from 'react-hot-toast';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CreatorPixel - Own Your Audience Data',
  description: 'The identity intelligence platform for creators. See who watches, clicks, and engages with your content.',
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
        <Script id="rb2b" strategy="afterInteractive">
          {`!function(key){if(window.reb2b)return;window.reb2b={loaded:true};var s=document.createElement("script");s.async=true;s.src="https://ddwl4m2hdecbv.cloudfront.net/b/"+key+"/"+key+".js.gz";document.getElementsByTagName("script")[0].parentNode.insertBefore(s,document.getElementsByTagName("script")[0])}("GOYPYH44EYOX");`}
        </Script>
      </body>
    </html>
  );
}
