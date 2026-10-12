import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import LocalDataControls from "./local-data-controls";
import AuthShell from "./auth/auth-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Company Profile",
  description: "Create, save, and export a customer-ready company profile.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><div className="flex-1">{children}</div><footer className="border-t border-gray-200 bg-white px-4 py-6 text-center text-xs text-gray-500"><span>AI Company Profile</span><span className="mx-2">·</span><a href="/privacy" className="underline">Privacy</a><span className="mx-2">·</span><a href="/terms" className="underline">Terms</a></footer><AuthShell /><LocalDataControls /></body>
    </html>
  );
}
