import type { Metadata } from "next";
import { headers } from "next/headers";
import "./slots.css";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  const title = "BFNRY — Whimsi Arcade";
  const description = "Tiny games for familiar people. Drop in, make a choice, and see what the moment gives you.";

  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: [{ url: image, width: 1536, height: 1024, alt: "BFNRY — A little luck, shared together." }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
