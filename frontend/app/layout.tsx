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

// Application-level metadata — rendered into <head> by Next.js App Router.
export const metadata: Metadata = {
  title: "Zoom Clone",
  description: "A full-stack video meeting application built with Next.js and Django.",
};

// RootLayout wraps every page in the application.
// It applies the global fonts and CSS, and sets the html/body structure.
// Individual pages are injected via the {children} slot.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
