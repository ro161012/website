import type { Metadata, Viewport } from "next";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/newsreader";
import { AsciiBackdrop } from "@/components/backdrop/ascii-backdrop";
import { GlassProvider } from "@/components/glass/glass";
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Tesseract — Every grade, in its place.",
    template: "%s · Tesseract",
  },
  description:
    "Tesseract is an independent grade tracker for Home Access Center: current averages, assignment history, trends, what-if planning and attendance, without ads or analytics.",
  applicationName: "Tesseract",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Tesseract",
    statusBarStyle: "black-translucent",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#07080a",
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <AsciiBackdrop />
        <div aria-hidden="true" className="app-scrim" />
        <GlassProvider>
          {children}
          <RegisterServiceWorker />
        </GlassProvider>
      </body>
    </html>
  );
}
