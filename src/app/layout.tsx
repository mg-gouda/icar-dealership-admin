import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4002/api/v1';

export async function generateMetadata(): Promise<Metadata> {
  let faviconUrl: string | null = null;
  try {
    const res = await fetch(`${API}/public/company-info`, { next: { revalidate: 300 } });
    if (res.ok) faviconUrl = (await res.json()).faviconUrl ?? null;
  } catch {}
  return {
    title: { template: '%s | iCar Management System', default: 'iCar Management System' },
    description: "منصة متكاملة لإدارة معارض السيارات متعددة الفروع",
    icons: { icon: faviconUrl ?? '/favicon.ico' },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={cairo.className}>
        {children}
      </body>
    </html>
  );
}
