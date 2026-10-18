import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {width:'device-width',initialScale:1,viewportFit:'cover'};

export const metadata: Metadata = {
  title: "יחד לאימון | הסעות גבעות בר",
  description: "לוח ההסעות השבועי של הורי הקבוצה",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}

