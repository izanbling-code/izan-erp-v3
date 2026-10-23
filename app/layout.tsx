import "./globals.css";
import { Providers } from "./providers";
export const metadata = {
  title: "Izan Bling ERP v3",
  description: "Next-generation ERP tailored for speed and ACID compliance.",
};

export default function RootLayout({ children }: { children: any }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-300 font-sans antialiased transition-colors duration-300">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}