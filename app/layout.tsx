import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const appFont = Plus_Jakarta_Sans({
  variable: "--font-app",
  subsets: ["latin"],
  display: "swap",
});

import { ThemeProvider } from "@/components/ThemeProvider";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0d1a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // cegah zoom otomatis iOS saat mengetik di input berfont kecil
  viewportFit: "cover", // aktifkan env(safe-area-inset-*) untuk notch & home indicator
};

export const metadata: Metadata = {
  title: "Zeey Studio | Portal Klien",
  description: "Portal klien fotografi profesional dan sistem manajemen.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Zeey Studio",
  },
  formatDetection: {
    telephone: false,
  },
};

import { PwaRegistrar } from "@/components/PwaRegistrar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${appFont.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('zeey_theme') === 'dark' || (!('zeey_theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground transition-colors duration-300">
        <ThemeProvider>
          {children}
          <PwaRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}
