export default function ERPShell({ children }: { children: React.ReactNode }) {
  // V3 Update: The sidebar and layout margins are now handled globally by layout.tsx.
  // This shell has been hollowed out to act as a transparent pass-through for legacy V2 pages.
  return <div className="w-full h-full">{children}</div>;
}