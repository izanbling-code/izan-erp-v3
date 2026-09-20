"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function PrintInvoiceTemplate() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [templates, setTemplates] = useState<any>({});
  const [loading, setLoading] = useState(true);

    useEffect(() => {
    Promise.all([
      fetch(`/api/sales/invoices?id=${id}`).then(r => r.json()),
      fetch(`/api/settings`).then(r => r.json())
    ]).then(([invData, setData]) => {
      if (invData.ok && invData.invoices.length > 0) {
        setInvoice(invData.invoices[0]);
      } else {
        setInvoice({ notFound: true });
      }
      
      if (setData.ok) {
        setCompany(setData.company);
        setTemplates(setData.settings?.templates || {});
      }
      setLoading(false);
    });
  }, [id]);

  if (loading || !invoice) return <div className="p-10 text-center text-indigo-500 font-bold animate-pulse">Loading Print Engine...</div>; if (invoice.notFound) return <div className="p-10 text-center text-rose-500 font-bold">Error: Invoice could not be found in the database.</div>;

  const primaryColor = templates.primaryColor || "#4f46e5";
  const docTitle = templates.invoiceTitle || "INVOICE";

  return (
    <div className="bg-gray-100 min-h-screen py-10 print:py-0 print:bg-white">
      <div className="max-w-4xl mx-auto bg-white shadow-xl print:shadow-none min-h-[1056px] flex flex-col">
        
        {/* ACTION BAR (Hidden in print) */}
        <div className="print:hidden flex justify-between items-center bg-gray-900 text-white px-8 py-4 rounded-t-lg">
          <h2 className="font-bold tracking-widest uppercase text-sm">Document Print Engine</h2>
          <button onClick={() => window.print()} className="bg-white text-gray-900 px-6 py-2 rounded font-bold shadow-sm hover:bg-gray-100 transition">🖨️ Print / Save PDF</button>
        </div>

        <div className="p-12 flex-1 flex flex-col">
          {/* HEADER */}
          <div className="flex justify-between items-start border-b-4 pb-8 mb-8" style={{ borderColor: primaryColor }}>
            <div>
              <h1 className="text-5xl font-black uppercase tracking-widest" style={{ color: primaryColor }}>{docTitle}</h1>
              <p className="text-gray-900 font-bold text-lg mt-3">{invoice.invoiceNo}</p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-black text-gray-900">{company?.name || "Izan Bling HQ"}</h2>
              {company?.legalName && <p className="text-sm text-gray-500 font-bold mt-1">{company.legalName}</p>}
              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap max-w-[250px] ml-auto">{company?.address || "Company Address"}</p>
              <p className="text-sm text-gray-600">{company?.city} {company?.country}</p>
              {company?.ntn && <p className="text-sm text-gray-600 mt-2"><span className="font-bold">NTN:</span> {company.ntn}</p>}
              {company?.phone && <p className="text-sm text-gray-600"><span className="font-bold">Phone:</span> {company.phone}</p>}
              {company?.email && <p className="text-sm text-gray-600"><span className="font-bold">Email:</span> {company.email}</p>}
            </div>
          </div>

          {/* META INFO */}
          <div className="flex justify-between mb-10">
            <div className="bg-gray-50 p-5 rounded-lg border border-gray-100 min-w-[280px]">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Billed To</h3>
              <p className="font-black text-lg text-gray-900">{invoice.customer?.name || "Walk-in Customer"}</p>
              {invoice.customer?.phone && <p className="text-sm text-gray-600 mt-1">{invoice.customer.phone}</p>}
              {invoice.customer?.email && <p className="text-sm text-gray-600">{invoice.customer.email}</p>}
            </div>
            
            <div className="text-right space-y-2 mt-2">
              <div className="flex justify-end gap-4"><span className="font-bold text-gray-500 uppercase text-xs tracking-wider">Date:</span> <span className="font-bold text-gray-900">{new Date(invoice.invoiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
              {invoice.dueDate && <div className="flex justify-end gap-4"><span className="font-bold text-gray-500 uppercase text-xs tracking-wider">Due Date:</span> <span className="font-bold text-gray-900">{new Date(invoice.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>}
              <div className="flex justify-end gap-4"><span className="font-bold text-gray-500 uppercase text-xs tracking-wider">Status:</span> <span className="font-bold uppercase" style={{ color: invoice.status === "POSTED" ? "#b42318" : (invoice.status === "DRAFT" ? "#475467" : "#059669") }}>{invoice.status === "POSTED" ? "UNPAID" : invoice.status}</span></div>
            </div>
          </div>

          {/* ITEMS TABLE */}
          <table className="erp-data-table">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-white" style={{ backgroundColor: primaryColor }}>
                <th className="py-3 px-4 rounded-tl-lg">Item Description</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4 text-right">Price</th>
                {Number(invoice.discount) > 0 && <th className="py-3 px-4 text-right">Discount</th>}
                <th className="py-3 px-4 text-right rounded-tr-lg">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 border-b-2 border-gray-200">
              {invoice.lines.map((l: any) => (
                <tr key={l.id} className="text-sm">
                  <td className="py-4 px-4">
                    <p className="font-bold text-gray-900">{l.product?.name}</p>
                    {l.description && <p className="text-xs text-gray-500 mt-1">{l.description}</p>}
                  </td>
                  <td className="py-4 px-4 text-center font-medium text-gray-700">{l.quantity}</td>
                  <td className="py-4 px-4 text-right font-medium text-gray-700">₨ {Number(l.unitPrice).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  {Number(invoice.discount) > 0 && <td className="py-4 px-4 text-right font-medium text-gray-500">{Number(l.discount) > 0 ? `- ₨ ${Number(l.discount).toFixed(2)}` : "-"}</td>}
                  <td className="py-4 px-4 text-right font-black text-gray-900">₨ {Number(l.total).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* TOTALS & NOTES AREA */}
          <div className="flex justify-between items-start mt-auto pt-6">
            
            {/* NOTES & BANK DETAILS */}
            <div className="w-1/2 pr-8 space-y-6">
              {invoice.notes && (
                <div>
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Invoice Notes</h4>
                  <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-100">{invoice.notes}</p>
                </div>
              )}
              {templates.bankDetails && (
                <div>
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Payment Details</h4>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border border-gray-100">{templates.bankDetails}</div>
                </div>
              )}
            </div>

            {/* TOTALS CALCULATION */}
            <div className="w-80 space-y-3 text-sm">
              <div className="flex justify-between text-gray-600 font-medium"><span>Subtotal:</span> <span>₨ {Number(invoice.subtotal).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
              {Number(invoice.discount) > 0 && <div className="flex justify-between text-rose-600 font-medium"><span>Discount:</span> <span>- ₨ {Number(invoice.discount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>}
              {Number(invoice.tax) > 0 && <div className="flex justify-between text-gray-600 font-medium"><span>Sales Tax:</span> <span>₨ {Number(invoice.tax).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>}
              {Number(invoice.deliveryCharges) > 0 && <div className="flex justify-between text-gray-600 font-medium"><span>Delivery:</span> <span>₨ {Number(invoice.deliveryCharges).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>}
              
              <div className="flex justify-between items-center text-lg font-black border-t-2 border-gray-900 pt-3 mt-3">
                <span className="uppercase tracking-widest text-xs text-gray-500">Grand Total:</span> 
                <span style={{ color: primaryColor }}>₨ {Number(invoice.total).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
            </div>
          </div>

          {/* FOOTER TERMS */}
          <div className="mt-12 pt-6 border-t-2 border-gray-100 flex justify-between items-end text-xs text-gray-500">
            <div className="whitespace-pre-wrap max-w-xl">
              {templates.terms && (
                <>
                  <span className="font-bold text-gray-900 block mb-1">Terms & Conditions</span>
                  {templates.terms}
                </>
              )}
            </div>
            <div className="text-right font-medium max-w-xs">
              {templates.footerNote || "Thank you for your business!"}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}