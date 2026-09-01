import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rift Rush — Neon Survival Arena",
  description:
    "Blast enemy waves, stack powerful upgrades, dash through danger, and defeat giant rift bosses in this free browser game.",
  applicationName: "Rift Rush",
  openGraph: {
    title: "Rift Rush — Neon Survival Arena",
    description: "Blast the swarm. Build wild upgrades. Survive the rift.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Rift Rush — Neon Survival Arena",
    description: "Blast the swarm. Build wild upgrades. Survive the rift.",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#060817",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
