import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tyrano World",
  description: "Anonymous realtime open chat built with Next.js and Supabase."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
