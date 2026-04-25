import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Word Bridge Race",
  description: "Race to type a word that bridges two letters.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={cn("dark", GeistSans.variable, GeistMono.variable)}
    >
      <body className="font-sans antialiased">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
