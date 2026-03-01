"use client";

import ThemeProvider from "@/components/ThemeProvider";
import GlobalCursor from "@/components/GlobalCursor";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <GlobalCursor />
      {children}
    </ThemeProvider>
  );
}
