import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voice Chess — Groq",
  description: "Groq Whisper voice input for chess position editing.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
