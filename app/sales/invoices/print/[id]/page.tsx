"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Printer, ChevronLeft } from "lucide-react";
import { useERPConfig } from "@/app/contexts/SettingsContext";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetch(`/api/sales/invoices?id=${params.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.ok && data.invoices.length > 0) {
            setInvoice(data.invoices[0]);
          }
          setLoading(false);
        });
    }
  }, [params.id]);

  if (loading) return <div className="min-h-screen bg-slate-200 flex items-center justify-center"><div className="animate-pulse text-teal-600 font-bold tracking-widest">LOADING DOCUMENT...</div></div>;
  if (!invoice) return <div className="min-h-screen bg-slate-200 flex items-center justify-center flex-col gap-4"><h1 className="text-2xl font-bold text-slate-800">Invoice Not Found</h1></div>;

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
  
  const docTitle = invoice.status === "DRAFT" ? "PROFORMA INVOICE" : "SALES INVOICE";
  const formattedDate = new Date(invoice.invoiceDate).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="min-h-screen bg-slate-200 print:bg-white text-slate-900 font-sans flex flex-col items-center">
      <style dangerouslySetInnerHTML={{__html: `@media print { @page { size: A4; margin: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}} />

      <div className="print:hidden w-full bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-md sticky top-0 z-50">
        <Link href="/sales" className="flex items-center gap-2 text-slate-300 hover:text-teal-400 transition-colors font-semibold text-sm">
          <ChevronLeft className="w-5 h-5" /> Back to Invoices
        </Link>
        <button onClick={() => window.print()} className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all">
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      <div className="p-8 print:p-0 flex justify-center w-full overflow-x-auto custom-scrollbar pb-20">
        
        {/* THERMAL TEMPLATE */}
        {template === "thermal" && (
          <div className="w-[80mm] print:w-full bg-white text-zinc-900 p-4 print:p-2 font-mono text-[11px] leading-tight shadow-2xl print:shadow-none border border-zinc-200 print:border-none mx-auto relative min-h-[50vh] flex flex-col">
            <div className="text-center pb-3 border-b border-dashed border-zinc-400">
              <h2 className="font-bold text-sm tracking-wider uppercase">{companyName}</h2>
              {phone && <p className="text-[10px] text-zinc-600">Tel: {phone}</p>}
            </div>
            <div className="py-2.5 space-y-0.5 text-[10px] border-b border-dashed border-zinc-400">
              <div className="flex justify-between"><span>DOC: {invoice.invoiceNo}</span><span>DATE: {formattedDate}</span></div>
            </div>
            <table className="w-full my-2 text-left text-[10px]">
              <thead><tr className="border-b border-zinc-300"><th className="py-1">ITEM</th><th className="py-1 text-center">QTY</th><th className="py-1 text-right">TOTAL</th></tr></thead>
              <tbody className="divide-y divide-zinc-200">
                {invoice.lines.map((l: any) => (<tr key={l.id}><td className="py-1.5 font-sans font-semibold pr-2">{l.product?.name || "Item"}</td><td className="py-1.5 text-center">{l.quantity}</td><td className="py-1.5 text-right font-mono">{formatAmount(l.total)}</td></tr>))}
              </tbody>
            </table>
            <div className="pt-2 border-t border-dashed border-zinc-400 space-y-1 text-right text-[11px]">
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-zinc-300"><span>TOTAL:</span><span>{currency} {formatAmount(invoiceTotal)}</span></div>
            </div>
            {footerNote && <div className="mt-auto pt-6 text-center text-[9px] text-zinc-500 uppercase whitespace-pre-line leading-relaxed">{footerNote}</div>}
          </div>
        )}

        {/* MODERN TEMPLATE (Bordered & Full Height) */}
        {template === "modern" && (
          <div className="w-[210mm] min-h-[297mm] print:w-full print:min-h-screen bg-white text-zinc-900 p-[15mm] print:p-[10mm] shadow-2xl print:shadow-none font-sans text-sm mx-auto flex flex-col shrink-0">
            
            {/* 1. Header Section */}
            <div className="flex justify-between items-start mb-6 shrink-0">
              <div className="flex items-center gap-4">
                {showLogo && <div className="w-14 h-14 rounded-xl border-2 border-zinc-200 text-zinc-800 flex items-center justify-center font-black text-2xl bg-white shadow-sm">{companyName.substring(0, 2).toUpperCase()}</div>}
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-zinc-900">{companyName}</h1>
                  {(ntn || phone) && <p className="text-zinc-500 text-sm mt-0.5">NTN: {ntn} | Ph: {phone}</p>}
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block bg-white text-zinc-800 font-bold px-4 py-1.5 rounded-full text-xs uppercase tracking-widest border border-zinc-300 shadow-sm">{docTitle}</span>
                <p className="text-zinc-900 font-black text-lg mt-3">#{invoice.invoiceNo}</p>
                <p className="text-zinc-500 text-xs mt-1 font-medium">Issued: {formattedDate}</p>
              </div>
            </div>

            {/* 2. Customer & Account Status Box (Split with border) */}
            <div className="border border-slate-300 rounded-2xl grid grid-cols-2 mb-6 shadow-sm overflow-hidden shrink-0">
              <div className="p-5 border-r border-slate-300 bg-slate-50/50 print:bg-transparent">
                <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest mb-2 block">Billed To</span>
                <p className="font-bold text-zinc-900 text-lg">{customerName}</p>
                {invoice.customer?.phone && <p className="text-zinc-600 text-sm mt-1">{invoice.customer.phone}</p>}
                {invoice.customer?.address && <p className="text-zinc-600 text-sm mt-1">{invoice.customer.address}</p>}
              </div>
              <div className="p-5 flex flex-col justify-between bg-white">
                <div className="text-right">
                  <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest mb-2 block">Account Status</span>
                  <p className="font-medium text-zinc-700 text-base">
                    Balance: <span className={`font-bold ${isUnpaid ? 'text-rose-600' : 'text-emerald-600'}`}>{currency} {formatAmount(displayBalance)}</span>
                  </p>
                </div>
                {invoice.notes && (
                  <div className="mt-4 text-right">
                    <p className="text-xs text-zinc-500 italic ml-auto border-r-2 border-teal-500 pr-3 whitespace-pre-line">
                      {invoice.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Items Table (flex-1 expands to push everything else down) */}
            <div className="border border-slate-300 rounded-2xl shadow-sm flex flex-col mb-6">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-teal-700 text-white text-xs uppercase tracking-wider font-bold rounded-t-2xl">
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
                      <td className="p-4 text-right font-bold text-teal-700">{formatAmount(l.total)}</td>
                    </tr>
                  ))}
                  {/* Empty row to force table to stretch slightly if needed, purely visual */}
                  <tr className="bg-white"><td colSpan={4} className="p-2"></td></tr>
                </tbody>
              </table>
            </div>

            {/* 4. Bottom Totals & Instructions Area (Pushed to bottom by mt-auto) */}
            <div className="mt-auto shrink-0 border-t border-slate-200 pt-6">
              <div className="flex justify-between items-start gap-6">
                
                {/* Left Side: Amount in Words & Payment Instructions */}
                <div className="w-1/2 flex flex-col gap-4">
                  
                  {/* Amount in Words Block */}
                  <div className="border border-slate-300 rounded-xl p-4 bg-white shadow-sm">
                    <span className="block font-bold mb-1 uppercase text-[10px] tracking-widest text-teal-700">Amount in Words</span>
                    <span className="font-semibold text-sm text-zinc-800 capitalize leading-relaxed">
                      {currency} {amountToWords(invoiceTotal)}
                    </span>
                  </div>

                  {/* Payment Instructions Block */}
                  {isUnpaid && paymentInstructions && (
                    <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50 print:bg-transparent shadow-sm">
                      <span className="block font-bold mb-2 uppercase text-[10px] tracking-widest text-teal-700">Payment Instructions</span>
                      <span className="whitespace-pre-line leading-relaxed text-xs text-zinc-700">{paymentInstructions}</span>
                    </div>
                  )}
                </div>

                {/* Right Side: Totals */}
                <div className="w-[300px] space-y-2 text-right text-sm">
                  <div className="flex justify-between text-zinc-600"><span>Subtotal:</span><span>{formatAmount(invoice.subtotal)}</span></div>
                  {Number(invoice.discount) > 0 && <div className="flex justify-between text-zinc-600"><span>Discount:</span><span className="text-rose-500">- {formatAmount(invoice.discount)}</span></div>}
                  {Number(invoice.tax) > 0 && <div className="flex justify-between text-zinc-600"><span>Tax:</span><span>+ {formatAmount(invoice.tax)}</span></div>}
                  {Number(invoice.deliveryCharges) > 0 && <div className="flex justify-between text-zinc-600"><span>Delivery:</span><span>+ {formatAmount(invoice.deliveryCharges)}</span></div>}
                  
                  <div className="flex justify-between font-black text-xl text-zinc-900 border-t-2 border-zinc-900 pt-3 mt-3">
                    <span>Total:</span><span className="text-teal-600">{currency} {formatAmount(invoiceTotal)}</span>
                  </div>
                </div>
              </div>

              {/* 5. Footer Note */}
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

        {/* CLASSIC TEMPLATE */}
        {template === "classic" && (
           <div className="w-[210mm] min-h-[297mm] print:w-full print:min-h-screen bg-white text-zinc-900 p-[15mm] print:p-[10mm] shadow-2xl print:shadow-none font-sans text-sm mx-auto flex flex-col shrink-0">
            {/* Same structural flex-col update applied to Classic for consistency */}
            <div className="flex justify-between items-start border-b-2 border-zinc-900 pb-6 shrink-0">
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tight text-zinc-900">{companyName}</h1>
                <p className="text-zinc-600 text-sm mt-1 max-w-sm">{address}</p>
                {(ntn || phone) && <p className="text-zinc-600 text-sm mt-1">NTN: {ntn || "N/A"} | Phone: {phone || "N/A"}</p>}
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold uppercase tracking-widest text-zinc-800">{docTitle}</span>
                <p className="text-zinc-900 text-base mt-2 font-mono font-bold">#{invoice.invoiceNo}</p>
                <p className="text-zinc-500 text-sm mt-1">Date: {formattedDate}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 py-6 shrink-0">
              <div>
                <span className="font-bold uppercase text-zinc-500 text-xs tracking-wider">Billed To:</span>
                <p className="font-bold text-zinc-900 mt-2 text-lg">{customerName}</p>
                {invoice.customer?.phone && <p className="text-zinc-700 text-sm mt-1">{invoice.customer.phone}</p>}
              </div>
              <div className="text-right">
                <span className="font-bold uppercase text-zinc-500 text-xs tracking-wider">Account Status:</span>
                <p className="font-semibold text-zinc-900 mt-2 text-base">Balance Due: {currency} {formatAmount(displayBalance)}</p>
                {invoice.notes && <p className="text-zinc-600 text-sm mt-2 max-w-[250px] ml-auto italic whitespace-pre-line">"{invoice.notes}"</p>}
              </div>
            </div>

            <div className="mb-6 border-b border-zinc-300 pb-4">
               <table className="w-full border-collapse text-left text-sm">
                 <thead className="bg-zinc-100 text-xs uppercase tracking-wider">
                   <tr>
                     <th className="border-y border-zinc-300 p-3 font-bold">Item Description</th>
                     <th className="border-y border-zinc-300 p-3 text-center">Qty</th>
                     <th className="border-y border-zinc-300 p-3 text-right">Unit Rate</th>
                     <th className="border-y border-zinc-300 p-3 text-right">Amount</th>
                   </tr>
                 </thead>
                 <tbody>
                   {invoice.lines.map((line: any) => (
                     <tr key={line.id}>
                       <td className="border-b border-zinc-200 p-3 font-medium">{line.product?.name || "Item"}</td>
                       <td className="border-b border-zinc-200 p-3 text-center">{line.quantity}</td>
                       <td className="border-b border-zinc-200 p-3 text-right">{formatAmount(line.unitPrice)}</td>
                       <td className="border-b border-zinc-200 p-3 text-right">{formatAmount(line.total)}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>

            <div className="mt-auto shrink-0">
               <div className="flex justify-between items-start gap-8 mb-8">
                 <div className="w-1/2 space-y-4">
                    <div className="border border-zinc-300 p-4">
                       <span className="font-bold uppercase text-xs block mb-1 tracking-wider text-zinc-500">Amount in Words</span>
                       <span className="capitalize font-semibold text-zinc-800">{currency} {amountToWords(invoiceTotal)}</span>
                    </div>
                    {isUnpaid && paymentInstructions && (
                      <div className="border border-zinc-300 p-4">
                        <span className="font-bold uppercase text-xs block mb-2 tracking-wider text-zinc-500">Payment Instructions</span>
                        <span className="whitespace-pre-line leading-relaxed text-xs">{paymentInstructions}</span>
                      </div>
                    )}
                 </div>
                 <div className="w-80 space-y-2 text-right text-sm">
                   <div className="flex justify-between text-zinc-600"><span>Subtotal:</span><span>{formatAmount(invoice.subtotal)}</span></div>
                   {Number(invoice.discount) > 0 && <div className="flex justify-between text-zinc-600"><span>Discount:</span><span>- {formatAmount(invoice.discount)}</span></div>}
                   {Number(invoice.tax) > 0 && <div className="flex justify-between text-zinc-600"><span>Sales Tax:</span><span>+ {formatAmount(invoice.tax)}</span></div>}
                   {Number(invoice.deliveryCharges) > 0 && <div className="flex justify-between text-zinc-600"><span>Delivery:</span><span>+ {formatAmount(invoice.deliveryCharges)}</span></div>}
                   <div className="flex justify-between font-black text-xl border-t-2 border-zinc-900 pt-3 mt-3 text-zinc-900">
                     <span>Grand Total:</span><span>{currency} {formatAmount(invoiceTotal)}</span>
                   </div>
                 </div>
               </div>
               
               {footerNote && (
                 <div className="pt-4 border-t border-zinc-300 text-center">
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest whitespace-pre-line">
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
