"use client";

import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import { SettingsProvider } from "./contexts/SettingsContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <>{children}</>;

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SettingsProvider>
        {children}
      </SettingsProvider>
    </ThemeProvider>
  );
}
