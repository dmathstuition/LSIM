import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "dmaths · Learner Tracking",
  description: "Teacher accountability & learner progress tracking",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Set the theme before first paint to avoid a flash of the wrong theme.
const noFlash = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
