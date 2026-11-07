import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tomie AI",
  description: "Try to change Tomie's mood! Be careful what you say to her, she might get angry...",
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
  openGraph: {
    title: "Tomie AI",
    description: "Try to change Tomie's mood! Be careful what you say to her, she might get angry...",
    images: ['/img/banner.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Tomie AI",
    description: "Try to change Tomie's mood! Be careful what you say to her, she might get angry...",
    images: ['/img/banner.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
