import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import ThemeProvider from "@/components/ThemeProvider";

// Rounded geometric sans to match the D-MATHS brand.
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "D-MATHS · Learner Tracking",
  description: "We create solutions for your success — learner progress & accountability tracking",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Set the theme before first paint to avoid a flash of the wrong theme.
const noFlash = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      <head><script dangerouslySetInnerHTML={{ __html: noFlash }} /></head>
      <body>
        <ThemeProvider>
          <NavBar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
