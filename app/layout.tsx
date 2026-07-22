import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BFNRY — the group chat arcade",
  description: "Tiny games, fictional Bux, and bragging rights for friends.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
