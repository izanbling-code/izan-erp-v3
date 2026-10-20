"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, FileText, Download, AlertTriangle } from "lucide-react";
import { useERPConfig } from "@/app/contexts/SettingsContext";

export default function DynamicReportViewer() {
  const params = useParams();
  const router = useRouter();
  const { formatAmount, currency } = useERPConfig("general");
  const { config: generalConfig } = useERPConfig("general");
  
  const [report, setReport] = useState<{ title: string, columns: string[], rows: string[][] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const fetchUrl = `/api/reports/${params.slug}?_t=${Date.now()}`;
    
    fetch(fetchUrl, { cache: 'no-store' })
      .then(async (res) => {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          if (json.ok) {
            if (json.data && json.data.columns) {
              setReport(json.data);
            } else if (json.rows && Array.isArray(json.rows) && json.rows.length > 0) {
              const sampleRow = json.rows[0];
              const validKeys = Object.keys(sampleRow).filter(k => !k.toLowerCase().endsWith('id') && k.toLowerCase() !== 'id' && k !== 'createdAt' && k !== 'updatedAt');
              const columns = validKeys.map(k => k.charAt(0).toUpperCase() + k.slice(1).replace(/([A-Z])/g, ' $1').trim());
              const mappedRows = json.rows.map((rowObj: any) => validKeys.map(k => {
                const val = rowObj[k];
                if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) return new Date(val).toLocaleDateString();
                return val !== null && val !== undefined ? String(val) : "-";
              }));
              setReport({ title: `${String(params.slug).toUpperCase()} REPORT`, columns, rows: mappedRows });
            } else if (json.rows && Array.isArray(json.rows) && json.rows.length === 0) {
               setReport({ title: `${String(params.slug).toUpperCase()} REPORT`, columns: ["Data"], rows: [] });
            } else { setErrorMsg(`API returned OK, but data format is unrecognized.`); }
          } else { setErrorMsg(json.error || `Server returned an error.`); }
        } catch (e) { setErrorMsg(`API did not return valid JSON.`); }
        setLoading(false);
      })
      .catch((err) => { setErrorMsg(`Network fetch failed: ${err.message}`); setLoading(false); });
  }, [params.slug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-teal-600 font-bold tracking-widest flex items-center gap-3"><FileText className="w-5 h-5" /> COMPILING REPORT...</div></div>;
  if (errorMsg || !report) return <div className="min-h-screen flex flex-col items-center justify-center text-slate-500 p-6"><AlertTriangle className="w-12 h-12 mb-4 text-rose-500 opacity-80" /><h2 className="text-xl font-bold">Report Could Not Be Loaded</h2><p className="text-sm font-mono text-rose-600 mt-2">{errorMsg}</p><button onClick={() => router.back()} className="mt-8 bg-slate-200 px-8 py-2.5 rounded-lg font-bold">Go Back</button></div>;
  
  return (
    <div className="space-y-6 relative z-10 w-full pb-10 print:pb-0 print:space-y-0">
      
      {/* WEB UI: Action Bar (Hidden on Print) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 print:hidden">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-zinc-300" />
          </button>
          <div>
            <p className="text-teal-600 dark:text-teal-400 text-xs font-bold tracking-widest uppercase mb-1">Drill-Down Analysis</p>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{report.title}</h1>
          </div>
        </div>
        <button onClick={() => window.print()} className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-teal-500/20 transition-all flex items-center gap-2">
          <Download className="w-4 h-4" /> Export Document
        </button>
      </div>

      {/* PRINT UI: Paper Header (Hidden on Web) */}
      <div className="hidden print:block border-b-2 border-black pb-4 mb-6 pt-4">
        <h1 className="text-3xl font-black text-black uppercase tracking-tight">{generalConfig?.companyName || "IZAN BLING ERP"}</h1>
        <div className="flex justify-between items-end mt-2">
          <h2 className="text-lg font-bold text-gray-700 uppercase">{report.title}</h2>
          <p className="text-sm font-semibold text-gray-500 font-mono">Date Generated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden print:bg-transparent print:shadow-none print:border-none print:rounded-none">
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-left text-sm whitespace-nowrap print:text-black">
            <thead className="bg-slate-50/50 dark:bg-zinc-950/30 text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold border-b border-slate-200/60 dark:border-white/5 print:bg-gray-100 print:text-black print:border-black print:border-b-2">
              <tr>
                {report.columns.map((col, i) => (
                  <th key={i} className={`p-4 print:py-2 print:px-2 ${col.toLowerCase().includes("total") || col.toLowerCase().includes("balance") || col.toLowerCase().includes("cost") || col.toLowerCase().includes("value") || col.toLowerCase().includes("qty") || col.toLowerCase().includes("quantity") || col.toLowerCase().includes("paid") || col.toLowerCase().includes("tax") || col.toLowerCase().includes("subtotal") ? "text-right" : ""}`}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 print:divide-gray-300">
              {report.rows.length === 0 ? (
                <tr><td colSpan={report.columns.length} className="py-16 text-center text-slate-500">No data available.</td></tr>
              ) : (
                report.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors print:hover:bg-transparent">
                    {row.map((cell, cellIndex) => {
                      const colName = report.columns[cellIndex].toLowerCase();
                      const isMoney = colName.includes("total") || colName.includes("balance") || colName.includes("cost") || colName.includes("value") || colName.includes("paid") || colName.includes("tax") || colName.includes("subtotal");
                      const isNumber = colName.includes("qty") || colName.includes("quantity");
                      
                      return (
                        <td key={cellIndex} className={`p-4 print:py-2 print:px-2 ${isMoney || isNumber ? "text-right font-mono font-semibold text-slate-900 dark:text-white print:text-black" : "text-slate-700 dark:text-zinc-300 print:text-black"}`}>
                          {isMoney ? `${currency} ${formatAmount(Number(cell) || 0)}` : cell}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* PRINT UI: Paper Footer (Hidden on Web) */}
      <div className="hidden print:block mt-8 text-center text-xs text-gray-400 font-mono">
        --- End of Report ---
      </div>
    </div>
  );
}
