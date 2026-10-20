"use client";

import { ThemeProvider } from "next-themes";
import { SettingsProvider } from "./contexts/SettingsContext";
// app/providers.tsx (or your ThemeProvider component)

// This suppresses a known false-positive warning from next-themes
// in React 19. The script it injects runs correctly during SSR.
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    // Check if the first argument is a string containing the specific warning
    if (typeof args[0] === 'string' && args[0].includes('Encountered a script tag')) {
      return; // Ignore this specific warning
    }
    // For all other errors, log them normally
    originalError.apply(console, args);
  };
} 
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SettingsProvider>
        {children}
      </SettingsProvider>
    </ThemeProvider>
  );
}
