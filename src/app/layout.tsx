import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "SWARMS — The Future of AI is Collective",
  description:
    "Swarms is an enterprise-grade framework for orchestrating autonomous AI agents that collaborate like a company. Build multi-agent systems that think, adapt, and solve together.",
  keywords: [
    "AI agents",
    "swarm intelligence",
    "multi-agent systems",
    "AI orchestration",
    "autonomous agents",
  ],
  openGraph: {
    title: "SWARMS — The Future of AI is Collective",
    description:
      "Enterprise-grade AI agent orchestration. Multiple models working together as one.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
