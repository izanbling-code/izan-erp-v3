"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function SystemAdminPage() {
  const router = useRouter();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger the ZIP Backup Download
  async function handleBackup() {
    try {
      setIsBackingUp(true);
      const response = await fetch("/api/admin/backup");
      
      if (!response.ok) throw new Error("Failed to generate backup");

      // Create a hidden link to trigger the browser's download prompt
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      // Generate filename with today's date
      const date = new Date().toISOString().split("T")[0];
      link.setAttribute("download", `Izan_Bling_Backup_${date}.zip`);
      
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      
    } catch (error) {
      alert("Error creating backup. Please check console.");
      console.error(error);
    } finally {
      setIsBackingUp(false);
    }
  }

  // Handle the Restore Upload
  function handleRestore(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Safety Alert: Restoring relational SQL databases from raw JSON requires foreign-key disabling
    alert(
      "WARNING: You have selected " + file.name + ".\n\n" +
      "Because this ERP uses a strict Relational Cloud Database, standard JSON restores are temporarily locked in this UI to prevent Foreign-Key corruption.\n\n" +
      "To fully restore a database state, please use the 1-Click Restore inside your Neon Cloud Dashboard!"
    );
    
    setIsRestoring(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="erp-page" style={{ padding: "40px", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ marginBottom: "30px" }}>
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 800, color: "#111827" }}>System Administration</h1>
        <p style={{ margin: "8px 0 0", color: "#6b7280", fontSize: "14px" }}>
          Manage your cloud data backups, restorations, and system resets from this master console.
        </p>
      </div>

      <div style={{ display: "grid", gap: "20px" }}>
        
        {/* BACKUP MODULE */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>Export System Backup</h3>
            <p style={{ margin: "5px 0 0", fontSize: "13px", color: "#6b7280" }}>
              Generates a compressed .zip folder of your entire cloud database to your local PC.
            </p>
          </div>
          <button 
            onClick={handleBackup} 
            disabled={isBackingUp}
            style={{ padding: "10px 20px", background: "#111827", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: isBackingUp ? "default" : "pointer" }}
          >
            {isBackingUp ? "⏳ Compressing..." : "📥 Download Backup"}
          </button>
        </div>

        {/* RESTORE MODULE */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>Restore System Data</h3>
            <p style={{ margin: "5px 0 0", fontSize: "13px", color: "#6b7280" }}>
              Upload a previously exported .zip backup file to restore system records.
            </p>
          </div>
          
          <input 
            type="file" 
            accept=".zip" 
            ref={fileInputRef} 
            style={{ display: "none" }} 
            onChange={handleRestore}
          />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isRestoring}
            style={{ padding: "10px 20px", background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}
          >
            {isRestoring ? "Uploading..." : "📂 Upload Zip File"}
          </button>
        </div>

        {/* FACTORY RESET MODULE */}
        <div style={{ background: "#fffcfc", border: "1px solid #fecaca", borderRadius: "12px", padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#991b1b" }}>Factory Reset</h3>
            <p style={{ margin: "5px 0 0", fontSize: "13px", color: "#b91c1c" }}>
              Permanently wipe all transaction data from the system (keeps company profile and master admins).
            </p>
          </div>
          <button 
            onClick={() => router.push("/admin/reset")}
            style={{ padding: "10px 20px", background: "#dc2626", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}
          >
            Go to Reset Page ⚠️
          </button>
        </div>

      </div>
    </div>
  );
}
