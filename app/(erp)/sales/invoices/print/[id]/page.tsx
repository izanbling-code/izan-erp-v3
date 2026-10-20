"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Printer, ChevronLeft, Truck, Loader2 } from "lucide-react";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import { supabase } from "@/app/lib/supabase";

// Helper to convert numbers to words
const amountToWords = (num: number): string => {
  if (num === 0) return "Zero";
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const convert = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 === 0 ? '' : 'and ' + convert(n % 100));
    if (n < 1000000) return convert(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 === 0 ? '' : convert(n % 1000));
    if (n < 1000000000) return convert(Math.floor(n / 1000000)) + 'Million ' + (n % 1000000 === 0 ? '' : convert(n % 1000000));
    return '';
  };
  return convert(Math.floor(num)).trim() + ' Only';
};

export default function InvoicePrintPage() {
  const params = useParams();
  const { config: appearance } = useERPConfig("appearance");
  const { config: general, formatAmount, currency } = useERPConfig("general");
  
  const [invoice, setInvoice] = useState<any>(null);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingCourier, setUpdatingCourier] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!params.id) return;
      
      try {
        setLoading(true);
        const { data: company } = await supabase.from("Company").select("id").limit(1).single();
        
        const { data: cData } = await supabase.from("Courier").select("id, name").eq("companyId", company?.id);
        if (cData) setCouriers(cData);

        const { data: iData, error } = await supabase
          .from("SalesInvoice")
          .select(`*, customer:Customer(*), lines:SalesInvoiceLine(*, product:Product(*))`)
          .eq("id", params.id)
          .single();
          
        if (iData) setInvoice(iData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [params.id]);

  const handleCourierChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCourierId = e.target.value;
    if (!invoice) return;
    
    setUpdatingCourier(true);
    try {
      const { error } = await supabase
        .from("SalesInvoice")
        .update({ courierId: newCourierId || null, updatedAt: new Date().toISOString() })
        .eq("id", invoice.id);
        
      if (!error) {
        setInvoice({ ...invoice, courierId: newCourierId });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingCourier(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-200 flex items-center justify-center"><div className="animate-pulse text-teal-600 font-bold tracking-widest">LOADING DOCUMENT...</div></div>;
  if (!invoice) return <div className="min-h-screen bg-slate-200 flex items-center justify-center flex-col gap-4"><h1 className="text-2xl font-bold text-slate-800">Invoice Not Found</h1><Link href="/sales" className="text-teal-600 underline">Go back</Link></div>;

  const invoiceTotal = Number(invoice.total) || 0;
  const amountPaid = Number(invoice.paid) || 0;
  const dbBalance = Number(invoice.balance);
  const displayBalance = dbBalance > 0 ? dbBalance : (invoiceTotal - amountPaid);
  const isUnpaid = displayBalance > 0;

  const template = appearance?.invoiceTemplate || "modern";
  const showLogo = appearance?.showLogoOnPrints ?? true;
  const footerNote = appearance?.invoiceFooterNote || "";
  const paymentInstructions = appearance?.paymentInstructions || "";
  
  const companyName = general?.companyName || "Izan Bling";
  const ntn = general?.ntn || "";
  const phone = general?.phone || "";
  const address = general?.address || "";
  const customerName = invoice.customer?.name || "Walk-in Cash Customer";
  
  const getTracking = (notes: string) => {
    if (!notes) return "";
    const match = notes.match(/Tracking:\s*([^|\n]+)/i);
    return match ? match[1].trim() : "";
  };
  const trackingNo = getTracking(invoice.notes || "");
  const assignedCourier = couriers.find(c => c.id === invoice.courierId);

  const docTitle = invoice.status === "DRAFT" ? "PROFORMA INVOICE" : "SALES INVOICE";
  const formattedDate = new Date(invoice.invoiceDate).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });

  const themePrimary = "var(--theme-primary, #0d9488)"; 
  const themeText = "var(--theme-text, #0f172a)";

  return (
    <div className="min-h-screen bg-slate-200 print:bg-white text-slate-900 font-sans flex flex-col items-center">
      <style dangerouslySetInnerHTML={{__html: `@media print { @page { size: A4; margin: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}} />

      {/* CONTROL BAR */}
      <div className="print:hidden w-full bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-md sticky top-0 z-50">
        <Link href="/sales" className="flex items-center gap-2 text-slate-300 hover:text-teal-400 transition-colors font-semibold text-sm">
          <ChevronLeft className="w-5 h-5" /> Back to Invoices
        </Link>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
            <Truck className="w-4 h-4 text-teal-400" />
            <select 
              value={invoice.courierId || ""} 
              onChange={handleCourierChange}
              disabled={updatingCourier}
              className="bg-transparent text-sm text-white outline-none cursor-pointer"
            >
              <option value="" className="text-black">No Courier Assigned</option>
              {couriers.map(c => (
                <option key={c.id} value={c.id} className="text-black">{c.name}</option>
              ))}
            </select>
            {updatingCourier && <Loader2 className="w-4 h-4 animate-spin text-teal-400" />}
          </div>

          <button onClick={() => window.print()} className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      <div className="p-8 print:p-0 flex justify-center w-full overflow-x-auto pb-20">
        
        {/* MODERN TEMPLATE */}
        {template === "modern" && (
          <div className="w-[210mm] min-h-[297mm] print:w-full print:min-h-screen bg-white text-zinc-900 p-[15mm] print:p-[10mm] shadow-2xl print:shadow-none font-sans text-sm mx-auto flex flex-col shrink-0">
            
            <div className="flex justify-between items-start mb-6 shrink-0">
              <div className="flex items-center gap-4">
                {showLogo && <div className="w-14 h-14 rounded-xl border-2 border-zinc-200 text-zinc-800 flex items-center justify-center font-black text-2xl bg-white shadow-sm">{companyName.substring(0, 2).toUpperCase()}</div>}
                <div>
                  <h1 className="text-3xl font-black tracking-tight" style={{ color: themeText }}>{companyName}</h1>
                  {(ntn || phone) && <p className="text-zinc-500 text-sm mt-0.5">NTN: {ntn} | Ph: {phone}</p>}
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block bg-white font-bold px-4 py-1.5 rounded-full text-xs uppercase tracking-widest border border-zinc-300 shadow-sm" style={{ color: themePrimary }}>{docTitle}</span>
                <p className="font-black text-lg mt-3" style={{ color: themeText }}>#{invoice.invoiceNo}</p>
                <p className="text-zinc-500 text-xs mt-1 font-medium">Issued: {formattedDate}</p>
              </div>
            </div>

            <div className="border border-slate-300 rounded-2xl grid grid-cols-2 mb-6 shadow-sm overflow-hidden shrink-0">
              <div className="p-5 border-r border-slate-300 bg-slate-50/50 print:bg-transparent">
                <span className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: themePrimary }}>Billed To</span>
                <p className="font-bold text-zinc-900 text-lg">{customerName}</p>
                {invoice.customer?.phone && <p className="text-zinc-600 text-sm mt-1">{invoice.customer.phone}</p>}
                {invoice.customer?.address && <p className="text-zinc-600 text-sm mt-1">{invoice.customer.address}</p>}
              </div>
              <div className="p-5 flex flex-col justify-between bg-white">
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: themePrimary }}>Account Status</span>
                  <p className="font-medium text-zinc-700 text-base">
                    Balance: <span className={`font-bold ${isUnpaid ? 'text-rose-600' : 'text-emerald-600'}`}>{currency} {formatAmount(displayBalance)}</span>
                  </p>
                  {assignedCourier && (
                    <p className="font-medium text-zinc-700 text-sm mt-1">
                      Courier: <span className="font-bold">{assignedCourier.name}</span>
                      {trackingNo && <span className="text-zinc-500 ml-2">(Trk: {trackingNo})</span>}
                    </p>
                  )}
                </div>
                {invoice.notes && (
                  <div className="mt-4 text-right">
                    <p className="text-xs text-zinc-500 italic ml-auto border-r-2 pr-3 whitespace-pre-line" style={{ borderColor: themePrimary }}>
                      {invoice.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="border border-slate-300 rounded-2xl shadow-sm flex flex-col mb-6">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="text-white text-xs uppercase tracking-wider font-bold rounded-t-2xl" style={{ backgroundColor: themePrimary }}>
                  <tr>
                    <th className="p-4 rounded-tl-2xl">Description</th>
                    <th className="p-4 text-center">Qty</th>
                    <th className="p-4 text-right">Price</th>
                    <th className="p-4 text-right rounded-tr-2xl">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoice.lines.map((l: any) => (
                    <tr key={l.id} className="bg-white">
                      <td className="p-4 font-semibold text-zinc-900 border-r border-slate-100">{l.product?.name || "Item"}</td>
                      <td className="p-4 text-center border-r border-slate-100">{l.quantity}</td>
                      <td className="p-4 text-right text-zinc-700 border-r border-slate-100">{formatAmount(l.unitPrice)}</td>
                      <td className="p-4 text-right font-bold" style={{ color: themePrimary }}>{formatAmount(l.total)}</td>
                    </tr>
                  ))}
                  <tr className="bg-white"><td colSpan={4} className="p-2"></td></tr>
                </tbody>
              </table>
            </div>

            <div className="mt-auto shrink-0 border-t border-slate-200 pt-6">
              <div className="flex justify-between items-start gap-6">
                <div className="w-1/2 flex flex-col gap-4">
                  <div className="border border-slate-300 rounded-xl p-4 bg-white shadow-sm">
                    <span className="block font-bold mb-1 uppercase text-[10px] tracking-widest" style={{ color: themePrimary }}>Amount in Words</span>
                    <span className="font-semibold text-sm text-zinc-800 capitalize leading-relaxed">
                      {currency} {amountToWords(invoiceTotal)}
                    </span>
                  </div>

                  {isUnpaid && paymentInstructions && (
                    <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50 print:bg-transparent shadow-sm">
                      <span className="block font-bold mb-2 uppercase text-[10px] tracking-widest" style={{ color: themePrimary }}>Payment Instructions</span>
                      <span className="whitespace-pre-line leading-relaxed text-xs text-zinc-700">{paymentInstructions}</span>
                    </div>
                  )}
                </div>

                <div className="w-[300px] space-y-2 text-right text-sm">
                  <div className="flex justify-between text-zinc-600"><span>Subtotal:</span><span>{formatAmount(invoice.subtotal)}</span></div>
                  {Number(invoice.discount) > 0 && <div className="flex justify-between text-zinc-600"><span>Discount:</span><span className="text-rose-500">- {formatAmount(invoice.discount)}</span></div>}
                  {Number(invoice.tax) > 0 && <div className="flex justify-between text-zinc-600"><span>Tax:</span><span>+ {formatAmount(invoice.tax)}</span></div>}
                  {Number(invoice.deliveryCharges) > 0 && <div className="flex justify-between text-zinc-600"><span>Delivery:</span><span>+ {formatAmount(invoice.deliveryCharges)}</span></div>}
                  
                  <div className="flex justify-between font-black text-xl border-t-2 border-zinc-900 pt-3 mt-3" style={{ color: themeText }}>
                    <span>Total:</span><span style={{ color: themePrimary }}>{currency} {formatAmount(invoiceTotal)}</span>
                  </div>
                </div>
              </div>

              {footerNote && (
                <div className="mt-8 text-center border-t border-slate-200 pt-4">
                   <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest whitespace-pre-line">
                     {footerNote}
                   </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}