import "./globals.css";
import Sidebar from "../components/Sidebar";
import CommandPalette from "../components/CommandPalette";

export const metadata = {
  title: "Izan Bling ERP v3",
  description: "Next-generation ERP tailored for speed and ACID compliance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 flex min-h-screen font-sans antialiased overflow-hidden">
        {/* Global Command Palette */}
        <CommandPalette />

        {/* Persistent Left Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          <header className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center shadow-md z-10">
            <span className="font-bold tracking-widest text-lg">IZAN BLING</span>
            <button className="text-slate-300 hover:text-white focus:outline-none text-xl">☰</button>
          </header>

          <div className="flex-1 overflow-y-auto relative scroll-smooth">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
