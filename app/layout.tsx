import "./globals.css";
import Sidebar from "../components/Sidebar";
import CommandPalette from "../components/CommandPalette";
import { Providers } from "./providers";

export const metadata = {
  title: "Izan Bling ERP v3",
  description: "Next-generation ERP tailored for speed and ACID compliance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-300 flex min-h-screen font-sans antialiased overflow-hidden transition-colors duration-300">
        <Providers>
          {/* Global Command Palette */}
          <CommandPalette/>

          {/* Persistent Left Sidebar */}
          <Sidebar/>

          {/* Main Content Area */}
          <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-slate-50 dark:bg-zinc-950 transition-colors duration-300">
            <header className="md:hidden bg-white dark:bg-zinc-900 text-slate-900 dark:text-white p-4 flex justify-between items-center shadow-md z-10 border-b border-slate-200 dark:border-white/5">
              <span className="font-bold tracking-widest text-lg">IZAN BLING</span>
              <button className="text-slate-500 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white focus:outline-none text-xl">☰</button>
            </header>

            <div className="flex-1 overflow-y-auto relative scroll-smooth custom-scrollbar">
              {children}
            </div>
          </main>
        </Providers>
      </body>
    </html>
  );
}
