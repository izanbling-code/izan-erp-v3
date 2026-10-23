"use client";
import { useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";

export default function ImageUpload({ value, onChange, label }: { value: string; onChange: (url: string) => void; label: string }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/shop/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) onChange(data.url);
      else alert("Upload failed: " + (data.error || "Unknown error"));
    } catch (err) {
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="block text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1.5">{label}</label>
      <div className="flex flex-col gap-2">
        {value && <img src={value} alt="Preview" className="w-full h-32 object-cover rounded-lg border border-white/10" />}
        <div className="flex gap-2">
          <input
            type="text"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
            className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-xs focus:border-teal-500/60 outline-none"
          />
          <label className="cursor-pointer bg-teal-500 hover:bg-teal-400 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 transition">
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <UploadCloud className="w-3 h-3" />}
            <span>Upload</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>
    </div>
  );
}