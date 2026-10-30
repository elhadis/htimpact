import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-noto-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "HT Impact Manager", template: "%s · HT Impact Manager" },
  description: "Program, beneficiary, and attendance management by HT Digital Solutions.",
  applicationName: "HT Impact Manager",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "HT Impact Manager", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#0E2A47",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${notoArabic.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
