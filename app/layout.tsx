import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BFNRY — Good vibes. Tiny games.",
  description: "A bright little internet arcade for Odd or Even and fictional Bux.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
