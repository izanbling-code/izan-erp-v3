"use client";

import { useState } from "react";
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { ELEMENT_REGISTRY } from "../registry";
import type { CanvasElement, ElementType, SectionConfig } from "../types";

interface Props {
  section: SectionConfig;
  onAdd: (type: ElementType) => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleHidden: (id: string) => void;
}

export default function SectionElementsPanel({
  section, onAdd, onSelect, onRemove, onToggleHidden,
}: Props) {
  const [open, setOpen] = useState(false);
  const els = section.elements ?? [];
  return (
    <div className="border-t border-white/10 p-3 space-y-2">
      <div className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">
        Elements ({els.length})
      </div>
      {els.map(el => (
        <div key={el.id}
          onClick={() => onSelect(el.id)}
          className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 text-xs cursor-pointer">
          <span className="flex-1 truncate">{el.name}</span>
          <button onClick={e => { e.stopPropagation(); onToggleHidden(el.id); }} className="p-1">
            {el.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
          <button onClick={e => { e.stopPropagation(); onRemove(el.id); }}
            className="p-1 text-rose-400 hover:bg-rose-500/20 rounded">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-center gap-2 px-2 py-2 rounded border border-dashed border-white/20 hover:border-teal-500/60 text-xs text-zinc-400 hover:text-teal-400">
        <Plus className="w-3 h-3" /> Add element
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-1">
          {(Object.keys(ELEMENT_REGISTRY) as ElementType[]).map(t => (
            <button key={t} onClick={() => { onAdd(t); setOpen(false); }}
              className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-left">
              {ELEMENT_REGISTRY[t].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}