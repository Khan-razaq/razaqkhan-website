import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ScrollProgress from "./ScrollProgress";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Razaq Khan",
  description: "Robotics Field Engineer at Directed Machines. Robotics, computer vision, and the messy gap between simulation and the field.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var mq = window.matchMedia('(prefers-color-scheme: dark)');
                  var getTheme = function() { return localStorage.getItem('theme') || 'auto'; };
                  var theme = getTheme();
                  var isDark = theme === 'on' || (theme === 'auto' && mq.matches);
                  if (isDark) document.documentElement.classList.add('dark');
                  // Follow device light/dark changes on every page while set to auto
                  mq.addEventListener('change', function() {
                    try {
                      if (getTheme() === 'auto') document.documentElement.classList.toggle('dark', mq.matches);
                    } catch (e) {}
                  });
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ScrollProgress />
        {children}
      </body>
    </html>
  );
}