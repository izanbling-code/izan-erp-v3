"use client";

import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import type { SectionConfig, SectionSchema, SettingField, BlockConfig } from "./types";
import { uid, FONT_LIBRARY } from "./registry";
import ImageUpload from "@/components/ImageUpload";
import { ICON_NAMES } from "./canvas/ElementIcons";

interface Props {
  section: SectionConfig;
  schema: SectionSchema;
  onChange: (patch: Record<string, any>) => void;
  onBlocksChange: (blocks: BlockConfig[]) => void;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
}

export default function SettingsPanel({
  section,
  schema,
  onChange,
  onBlocksChange,
  selectedBlockId,
  onSelectBlock,
}: Props) {
  return (
    <div className="p-4 space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">
          Section
        </p>
        <h2 className="text-lg font-bold">{section.name}</h2>
      </div>

      <div className="space-y-4">
        {schema.settingsSchema.map((field) => (
          <FieldRenderer
            key={field.key}
            field={field}
            value={section.settings[field.key]}
            onChange={(v) => onChange({ [field.key]: v })}
          />
        ))}
      </div>

      {schema.allowsBlocks && (
        <div className="pt-6 border-t border-white/10">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">
              Blocks ({section.blocks.length})
            </p>
            <button
              onClick={() => {
                const newBlock: BlockConfig = { id: uid(), type: "block", settings: {} };
                for (const f of schema.blockSchema || []) {
                  if (f.default !== undefined) newBlock.settings[f.key] = f.default;
                }
                onBlocksChange([...section.blocks, newBlock]);
                onSelectBlock(newBlock.id);
              }}
              className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 font-semibold"
            >
              <Plus className="w-3 h-3" /> Add block
            </button>
          </div>

          <div className="space-y-2">
            {section.blocks.map((block, idx) => {
              const isOpen = selectedBlockId === block.id;
              return (
                <div key={block.id} className="border border-white/10 rounded-lg overflow-hidden">
                  <button
                    onClick={() => onSelectBlock(isOpen ? null : block.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 transition text-xs font-medium"
                  >
                    {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span className="flex-1 text-left truncate">
                      {block.settings.label || block.settings.title || block.settings.heading || `Block ${idx + 1}`}
                    </span>
                    
                    <div
                      onClick={(e) => {
                        e.stopPropagation(); 
                        onBlocksChange(section.blocks.filter((b) => b.id !== block.id));
                      }}
                      className="p-1 hover:bg-rose-500/20 text-rose-400 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </div>
                  </button>
                  
                  {isOpen && (
                    <div className="p-3 space-y-3 bg-black/20">
                      {(schema.blockSchema || []).map((field) => (
                        <FieldRenderer
                          key={field.key}
                          field={field}
                          value={block.settings[field.key]}
                          onChange={(v) =>
                            onBlocksChange(
                              section.blocks.map((b) =>
                                b.id === block.id
                                  ? { ...b, settings: { ...b.settings, [field.key]: v } }
                                  : b
                              )
                            )
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: SettingField;
  value: any;
  onChange: (v: any) => void;
}) {
  const v = value !== undefined ? value : field.default;
  const label = (
    <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1.5">
      {field.label}
    </label>
  );

  switch (field.type) {
    case "text":
      return (
        <div>
          {label}
          <input
            type="text"
            value={v ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-teal-500/60 outline-none"
          />
        </div>
      );
    case "textarea":
    case "richtext":
      return (
        <div>
          {label}
          <textarea
            value={v ?? ""}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-teal-500/60 outline-none resize-none"
          />
        </div>
      );
    case "color":
      return (
        <div>
          {label}
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={v || "#000000"}
              onChange={(e) => onChange(e.target.value)}
              className="w-10 h-8 bg-transparent rounded cursor-pointer"
            />
            <input
              type="text"
              value={v || ""}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono focus:border-teal-500/60 outline-none"
            />
          </div>
        </div>
      );
    case "number":
      return (
        <div>
          {label}
          <input
            type="number"
            min={field.min}
            max={field.max}
            step={(field as any).step ?? 1}
            value={v ?? field.default ?? 0}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-teal-500/60 outline-none"
          />
        </div>
      );
    case "range":
      return (
        <div>
          {label}
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={field.min ?? 0}
              max={field.max ?? 100}
              step={field.step ?? 1}
              value={v ?? field.default ?? 0}
              onChange={(e) => onChange(Number(e.target.value))}
              className="flex-1 accent-teal-500"
            />
            <span className="text-xs font-mono w-10 text-right text-zinc-400">{v}</span>
          </div>
        </div>
      );
    case "select":
      return (
        <div>
          {label}
          <select
            value={v ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-teal-500/60 outline-none"
          >
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    case "image":
      return (
        <ImageUpload
          label={field.label}
          value={v ?? ""}
          onChange={(url) => onChange(url)}
        />
      );
    case "url":
      return (
        <div>
          {label}
          <input
            type="text"
            placeholder="/shop"
            value={v ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-teal-500/60 outline-none"
          />
        </div>
      );
    case "boolean":
      return (
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">
            {field.label}
          </span>
          <button
            onClick={() => onChange(!v)}
            className={`w-10 h-5 rounded-full transition ${v ? "bg-teal-500" : "bg-zinc-700"}`}
          >
            <span
              className={`block w-4 h-4 bg-white rounded-full transition-transform ${
                v ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      );
    case "alignment":
      return (
        <div>
          {label}
          <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                onClick={() => onChange(a)}
                className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition ${
                  v === a ? "bg-teal-500 text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      );
    case "font":
      return (
        <div>
          {label}
          <select
            value={v ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-teal-500/60 outline-none"
          >
            <option value="">Default (Theme)</option>
            {FONT_LIBRARY.map((f) => (
              <option key={f.value} value={f.value}>{f.family}</option>
            ))}
          </select>
        </div>
      );
    case "animation":
      return (
        <div>
          {label}
          <select
            value={v ?? "none"}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-teal-500/60 outline-none"
          >
            <option value="none">None</option>
            <option value="hover-zoom">Image Zoom</option>
            <option value="hover-lift">Card Lift</option>
            <option value="hover-fade">Fade Reveal</option>
          </select>
        </div>
      );
    case "icon":
      return (
        <div>
          {label}
          <select
            value={v ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-teal-500/60 outline-none"
          >
            <option value="">None</option>
            {ICON_NAMES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      );
    default:
      return null;
  }
}