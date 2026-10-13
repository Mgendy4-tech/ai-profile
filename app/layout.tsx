import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import LocalDataControls from "./local-data-controls";
import AuthShell from "./auth/auth-shell";
import LnkditWordmark from "./components/lnkdit-wordmark";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LNKDIT — Professional Company Profiles, Made Easier",
  description: "Create, refine, and export a polished company profile in one place.",
  applicationName: "LNKDIT",
  openGraph: { title: "LNKDIT — Professional Company Profiles, Made Easier", description: "Create, refine, and export a polished company profile in one place.", type: "website" },
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><div className="flex-1">{children}</div><footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-gray-200 bg-white px-4 py-6 text-center text-xs text-gray-500"><LnkditWordmark className="mr-1"/><span aria-hidden="true">·</span><a href="/privacy" className="underline">Privacy</a><span aria-hidden="true">·</span><a href="/terms" className="underline">Terms</a></footer><AuthShell /><LocalDataControls /></body>
    </html>
  );
}
