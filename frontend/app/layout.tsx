import type { Metadata } from "next";
import "./globals.css";
import "./sekreativ.css";

export const metadata: Metadata = {
  title: "Pulse — Autonomous Vendor Risk Agent",
  description:
    "Pulse watches your critical vendors on the live public web, verifies every claim against its real source, and produces a review-ready risk assessment. Automatically.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Mona+Sans:wght@400;500;600;700&family=Geologica:wght@300;400;500;600&family=Unbounded:wght@400;600;700;900&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
