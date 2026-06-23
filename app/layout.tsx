import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "dmaths · Learner Tracking",
  description: "Teacher accountability & learner progress tracking",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: "#EAEDF4" }}>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
