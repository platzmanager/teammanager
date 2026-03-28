import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const veneerThree = localFont({
  src: [
    {
      path: "../../public/fonts/VeneerThree.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/VeneerThree.woff",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-veneer",
  display: "swap",
  fallback: ["Impact", "Arial Black", "sans-serif"],
});

export const metadata: Metadata = {
  title: "TC Thalkirchen - Meldelisten",
  description: "Meldelisten-Verwaltung für den Tennisverein",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="h-full">
      <body
        className={`${roboto.variable} ${veneerThree.variable} h-full antialiased`}
      >
        {children}
        <Toaster richColors />
      </body>
    </html>
  );
}
