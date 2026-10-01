import "./globals.css";
import CommandPalette from "../components/CommandPalette";
import { Providers } from "./providers";
import GlobalShell from "./components/GlobalShell";

export const metadata = {
  title: "Izan Bling ERP v3",
  description: "Next-generation ERP tailored for speed and ACID compliance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-300 font-sans antialiased overflow-hidden transition-colors duration-300">
        <Providers>
          <CommandPalette />
          <GlobalShell>
            {children}
          </GlobalShell>
        </Providers>
      </body>
    </html>
  );
}
