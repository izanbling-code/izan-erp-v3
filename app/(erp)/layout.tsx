import GlobalShell from "@/app/components/GlobalShell";

export default function ERPLayout({ children }: { children: React.ReactNode }) {
  return (
    <GlobalShell>
      {children}
    </GlobalShell>
  );
}