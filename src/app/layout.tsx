import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import { ThemeProvider } from "@/context/theme-context";

import ReactQueryProvider from "@/components/providers/react-query-provider";
import { Toaster } from 'sonner';
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "ineedjob — Internship Outreach Automation",
  description: "Automated internship outreach pipeline powered by AI",
  metadataBase: new URL("https://ineedjob.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${geist.variable} dark`} suppressHydrationWarning>
      <body>
        <ReactQueryProvider>
            <ThemeProvider>
              {children}
              <Toaster position="top-right" theme="system" />
            </ThemeProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
