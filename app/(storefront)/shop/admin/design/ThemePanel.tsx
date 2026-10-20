"use client";

import type { ThemeConfig } from "./types";

const FONTS = [
  "Inter, sans-serif",
  "Georgia, serif",
  "'Playfair Display', serif",
  "'DM Sans', sans-serif",
  "'Space Grotesk', sans-serif",
  "system-ui, sans-serif",
];

export default function ThemePanel({
  theme,
  onChange,
}: {
  theme: ThemeConfig;
  onChange: (t: ThemeConfig) => void;
}) {
  const set = <K extends keyof ThemeConfig>(k: K, v: ThemeConfig[K]) =>
    onChange({ ...theme, [k]: v });

  const setColor = (k: keyof ThemeConfig["colors"], v: string) =>
    onChange({ ...theme, colors: { ...theme.colors, [k]: v } });

  const setTypo = (k: keyof ThemeConfig["typography"], v: string) =>
    onChange({ ...theme, typography: { ...theme.typography, [k]: v } });

  return (
    <div className="p-4 space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">
          Global
        </p>
        <h2 className="text-lg font-bold">Theme settings</h2>
      </div>

      <Group title="Colors">
        <ColorInput label="Primary" value={theme.colors.primary} onChange={(v) => setColor("primary", v)} />
        <ColorInput label="Secondary" value={theme.colors.secondary} onChange={(v) => setColor("secondary", v)} />
        <ColorInput label="Accent" value={theme.colors.accent} onChange={(v) => setColor("accent", v)} />
        <ColorInput label="Background" value={theme.colors.background} onChange={(v) => setColor("background", v)} />
        <ColorInput label="Surface" value={theme.colors.surface} onChange={(v) => setColor("surface", v)} />
        <ColorInput label="Text" value={theme.colors.text} onChange={(v) => setColor("text", v)} />
        <ColorInput label="Muted text" value={theme.colors.textMuted} onChange={(v) => setColor("textMuted", v)} />
        <ColorInput label="Border" value={theme.colors.border} onChange={(v) => setColor("border", v)} />
      </Group>

      <Group title="Typography">
        <Select
          label="Heading font"
          value={theme.typography.headingFont}
          options={FONTS}
          onChange={(v) => setTypo("headingFont", v)}
        />
        <Select
          label="Body font"
          value={theme.typography.bodyFont}
          options={FONTS}
          onChange={(v) => setTypo("bodyFont", v)}
        />
        <Input
          label="Base font size"
          value={theme.typography.baseFontSize}
          onChange={(v) => setTypo("baseFontSize", v)}
        />
        <Select
          label="Heading weight"
          value={theme.typography.headingWeight}
          options={["400", "500", "600", "700", "800", "900"]}
          onChange={(v) => setTypo("headingWeight", v)}
        />
      </Group>

      <Group title="Layout">
        <Input label="Border radius" value={theme.borderRadius} onChange={(v) => set("borderRadius", v)} />
        <Input label="Logo URL" value={theme.logo.url} onChange={(v) => set("logo", { ...theme.logo, url: v })} />
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 border-b border-white/10 pb-2">
        {title}
      </p>
      {children}
    </div>
  );
}
function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1.5">
        {label}
      </label>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-teal-500/60"
      />
    </div>
  );
}
function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value || "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-8 bg-transparent rounded cursor-pointer"
      />
      <span className="text-xs font-medium flex-1">{label}</span>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 bg-zinc-800 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] font-mono outline-none focus:border-teal-500/60"
      />
    </div>
  );
}
function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1.5">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-teal-500/60"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}