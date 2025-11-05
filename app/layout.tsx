import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import clsx from "clsx";

import { Providers } from "@/app/providers";
import { Header } from "@/components/Header";
import { Navigation } from "@/components/Navigation";

import favicon from "./favicon.png";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const lexend = localFont({
  src: "../fonts/lexend.woff2",
  display: "swap",
  variable: "--font-lexend",
});

export const metadata: Metadata = {
  title: "Libernet Documentation",
  description: "Libernet Documentation",
  authors: { url: "https://libernet.xyz", name: "The Libernet team" },
  icons: favicon.src,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={clsx("h-full antialiased", inter.variable, lexend.variable)}
      suppressHydrationWarning
    >
      <body className="flex min-h-full bg-white dark:bg-slate-900">
        <Providers>
          <div className="flex w-full flex-col">
            <Header />
            <div className="max-w-8xl relative mx-auto flex w-full flex-auto justify-center sm:px-2 lg:px-8 xl:px-12">
              <div className="hidden lg:relative lg:block lg:flex-none">
                <div className="absolute inset-y-0 right-0 w-[50vw] bg-slate-50 dark:hidden" />
                <div className="absolute top-16 right-0 bottom-0 hidden h-12 w-px bg-linear-to-t from-slate-800 dark:block" />
                <div className="absolute top-28 right-0 bottom-0 hidden w-px bg-slate-800 dark:block" />
                <div className="sticky top-19 -ml-0.5 h-[calc(100vh-4.75rem)] w-64 overflow-x-hidden overflow-y-auto py-16 pr-8 pl-0.5 xl:w-72 xl:pr-16">
                  <Navigation />
                </div>
              </div>
              {children}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
