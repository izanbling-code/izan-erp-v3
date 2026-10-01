"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Toaster, toast } from "react-hot-toast";
import ERPShell from "@/app/components/erp-shell";
import { supabase } from "@/app/lib/supabase";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import {
  Search,
  RefreshCw,
  Edit3,
  Trash2,
  CheckCircle2,
  RotateCcw,
  FileCheck,
  ShieldCheck,
  Undo2,
  Send,
  Scale,
  Wallet,
  Settings2,
  X,
} from "lucide-react";

type DocType = "PURCHASE_RETURN" | "TRANSFER_OUT";
type DocStatus = "DRAFT" | "POSTED";

type ReturnLineForm = {
  id: string;
  productId: string;
  quantity: string;
  unitCost: string;
  totalCost: number;
  reason: string;
};

export default function PurchaseReturnsAndTransfersPage() {
  const { settings, formatAmount, currency } = useERPConfig();
  const isCompact = settings?.appearance?.dataDensity === "compact";

  const [companyId, setCompanyId] = useState("001");
  const [records, setRecords] = useState<any[]>([]);
  const [linesByDoc, setLinesByDoc] = useState<Record<string, any[]>>({});
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseBills, setPurchaseBills] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | DocType>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | DocStatus>("ALL");

  const [showModal, setShowModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any | null>(null);

  const journalPrefix = settings?.numbering?.journalPrefix || "JE-";

  // Automatically resolved from Settings -> Accounting
  const configuredReceivableId =
    settings?.accounting?.returnReceivableAccountId ||
    settings?.accounting?.arAccountId ||
    "";
  const configuredInventoryId =
    settings?.accounting?.defaultInventoryAccountId || "";

  const [form, setForm] = useState({
    docType: "PURCHASE_RETURN" as DocType,
    docDate: new Date().toISOString().split("T")[0],
    supplierId: "",
    partyName: "",
    sourceBillId: "",
    sourceBillNo: "",
    warehouseId: "",
    notes: "",
  });

  const [lines, setLines] = useState<ReturnLineForm[]>([]);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      const { data: comp } = await supabase
        .from("Company")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (comp?.id) setCompanyId(comp.id);

      const [retRes, lineRes, prodRes, whRes, supRes, billRes, stkRes] =
        await Promise.all([
          supabase
            .from("PurchaseReturn")
            .select("*")
            .order("docDate", { ascending: false }),
          supabase.from("PurchaseReturnLine").select("*"),
          supabase.from("Product").select("*").order("name"),
          supabase.from("Warehouse").select("*").order("name"),
          supabase.from("Supplier").select("*").order("name"),
          supabase
            .from("PurchaseBill")
            .select("*, lines:PurchaseBillLine(*)")
            .order("billDate", { ascending: false }),
          supabase.from("Stock").select("*"),
        ]);

      let coaList: any[] = [];
      try {
        const r = await fetch("/api/accounts");
        const d = await r.json();
        coaList = d.accounts || (Array.isArray(d) ? d : []);
      } catch {
        const { data: accs } = await supabase
          .from("Account")
          .select("*")
          .order("code");
        coaList = accs || [];
      }

      const grouped: Record<string, any[]> = {};
      (lineRes.data || []).forEach((l: any) => {
        if (!grouped[l.returnId]) grouped[l.returnId] = [];
        grouped[l.returnId].push(l);
      });

      setRecords(retRes.data || []);
      setLinesByDoc(grouped);
      setProducts(prodRes.data || []);
      setWarehouses(whRes.data || []);
      setSuppliers(supRes.data || []);
      setPurchaseBills(billRes.data || []);
      setStocks(stkRes.data || []);
      setAccounts(coaList);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load Purchase Returns & Transfers.");
    } finally {
      setLoading(false);
    }
  }

  // Automatically resolve the Asset->Receivable and Asset->Inventory accounts from Settings / COA
  const resolvedAccounts = useMemo(() => {
    const assetAccounts = accounts.filter((a) => a.type === "ASSET");

    let recAcc = assetAccounts.find((a) => a.id === configuredReceivableId);
    if (!recAcc) {
      recAcc = assetAccounts.find((a) => {
        const n = (a.name || "").toLowerCase();
        const s = (a.systemCode || "").toLowerCase();
        return n.includes("receivable") || s.includes("receivable") || s.includes("ar");
      });
    }

    // Check if the first selected product has its own Inventory Asset Account mapped
    const firstProd = products.find((p) => p.id === lines[0]?.productId);
    let invAcc = assetAccounts.find(
      (a) => a.id === (firstProd?.inventoryAccountId || configuredInventoryId)
    );
    if (!invAcc) {
      invAcc = assetAccounts.find((a) => {
        const n = (a.name || "").toLowerCase();
        const s = (a.systemCode || "").toLowerCase();
        return n.includes("inventory") || n.includes("stock") || s.includes("inventory");
      });
    }

    return {
      receivable: recAcc || null,
      inventory: invAcc || null,
    };
  }, [accounts, configuredReceivableId, configuredInventoryId, lines, products]);

  function getStockInfo(productId: string, warehouseId: string) {
    const rec = stocks.find(
      (s) => s.productId === productId && s.warehouseId === warehouseId
    );
    const prod = products.find((p) => p.id === productId);
    return {
      onHand: Number(rec?.quantity || 0),
      avgCost: Number(rec?.averageCost || prod?.costPrice || 0),
    };
  }

  function openCreateModal(docType: DocType) {
    setEditingDoc(null);
    setForm({
      docType,
      docDate: new Date().toISOString().split("T")[0],
      supplierId: "",
      partyName: "",
      sourceBillId: "",
      sourceBillNo: "",
      warehouseId: warehouses[0]?.id || "",
      notes: "",
    });
    setLines([
      {
        id: crypto.randomUUID(),
        productId: "",
        quantity: "1",
        unitCost: "0",
        totalCost: 0,
        reason: "",
      },
    ]);
    setShowModal(true);
  }

  function openEditModal(doc: any) {
    if (doc.status === "POSTED") {
      toast.error("Posted documents are locked. Click 'Unpost to Draft' first to edit.");
      return;
    }
    setEditingDoc(doc);
    setForm({
      docType: (doc.docType as DocType) || "PURCHASE_RETURN",
      docDate: new Date(doc.docDate).toISOString().split("T")[0],
      supplierId: doc.supplierId || "",
      partyName: doc.partyName || "",
      sourceBillId: doc.sourceBillId || "",
      sourceBillNo: doc.sourceBillNo || "",
      warehouseId: doc.warehouseId || warehouses[0]?.id || "",
      notes: doc.notes || "",
    });

    const existingLines = (linesByDoc[doc.id] || []).map((l: any) => ({
      id: l.id,
      productId: l.productId,
      quantity: String(l.quantity),
      unitCost: String(l.unitCost),
      totalCost: Number(l.totalCost || 0),
      reason: l.reason || "",
    }));

    setLines(
      existingLines.length > 0
        ? existingLines
        : [
            {
              id: crypto.randomUUID(),
              productId: "",
              quantity: "1",
              unitCost: "0",
              totalCost: 0,
              reason: "",
            },
          ]
    );
    setShowModal(true);
  }

  function handleSelectSourceBill(billId: string) {
    const bill = purchaseBills.find((b) => b.id === billId);
    if (!bill) {
      setForm((prev) => ({ ...prev, sourceBillId: "", sourceBillNo: "" }));
      return;
    }

    const sup = suppliers.find((s) => s.id === bill.supplierId);
    const firstWarehouseId = bill.lines?.[0]?.warehouseId || form.warehouseId;

    setForm((prev) => ({
      ...prev,
      sourceBillId: bill.id,
      sourceBillNo: bill.billNo,
      supplierId: bill.supplierId || prev.supplierId,
      partyName: sup?.name || prev.partyName,
      warehouseId: firstWarehouseId,
    }));

    if (Array.isArray(bill.lines) && bill.lines.length > 0) {
      setLines(
        bill.lines.map((bl: any) => ({
          id: crypto.randomUUID(),
          productId: bl.productId,
          quantity: String(bl.quantity),
          unitCost: String(bl.unitCost),
          totalCost: Number(
            (Number(bl.quantity) * Number(bl.unitCost)).toFixed(2)
          ),
          reason: `Return against ${bill.billNo}`,
        }))
      );
      toast.success(`Auto-filled items from Invoice ${bill.billNo}`);
    }
  }

  function updateLine(id: string, field: keyof ReturnLineForm, value: string) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const updated = { ...line, [field]: value };

        if (field === "productId" && value) {
          const { avgCost } = getStockInfo(value, form.warehouseId);
          updated.unitCost = String(avgCost);
        }

        const q = parseFloat(updated.quantity) || 0;
        const c = parseFloat(updated.unitCost) || 0;
        updated.totalCost = Number((q * c).toFixed(2));
        return updated;
      })
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        productId: "",
        quantity: "1",
        unitCost: "0",
        totalCost: 0,
        reason: "",
      },
    ]);
  }

  function removeLine(id: string) {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  const totalAmount = useMemo(
    () => lines.reduce((sum, l) => sum + Number(l.totalCost || 0), 0),
    [lines]
  );

  async function handleSave(targetStatus: DocStatus) {
    const recAccountId = resolvedAccounts.receivable?.id || "";
    const invAccountId = resolvedAccounts.inventory?.id || "";

    if (!recAccountId || !invAccountId) {
      toast.error(
        "Missing default Inventory or Receivable Asset account in Settings -> Accounting."
      );
      return;
    }

    const validLines = lines.filter(
      (l) => l.productId && parseFloat(l.quantity) > 0
    );
    if (!form.warehouseId) {
      toast.error("Please select a warehouse.");
      return;
    }
    if (validLines.length === 0) {
      toast.error("Please add at least one item with quantity > 0.");
      return;
    }

    setSaving(true);
    try {
      const prefix = form.docType === "PURCHASE_RETURN" ? "PR-" : "TO-";
      const docNumber =
        editingDoc?.docNumber ||
        `${prefix}${String(records.length + 1).padStart(4, "0")}`;

      const supName =
        suppliers.find((s) => s.id === form.supplierId)?.name ||
        form.partyName ||
        "Counterparty";

      let docId = editingDoc?.id;

      if (editingDoc) {
        const { error: updErr } = await supabase
          .from("PurchaseReturn")
          .update({
            docType: form.docType,
            docDate: new Date(form.docDate).toISOString(),
            supplierId: form.supplierId || null,
            partyName: supName,
            sourceBillId: form.sourceBillId || null,
            sourceBillNo: form.sourceBillNo || null,
            warehouseId: form.warehouseId,
            receivableAccountId: recAccountId,
            inventoryAccountId: invAccountId,
            totalAmount,
            receivableBalance: targetStatus === "POSTED" ? totalAmount : 0,
            notes: form.notes,
            updatedAt: new Date().toISOString(),
          })
          .eq("id", docId);
        if (updErr) throw updErr;

        await supabase
          .from("PurchaseReturnLine")
          .delete()
          .eq("returnId", docId);
      } else {
        const { data: created, error: insErr } = await supabase
          .from("PurchaseReturn")
          .insert([
            {
              companyId,
              docNumber,
              docType: form.docType,
              docDate: new Date(form.docDate).toISOString(),
              status: "DRAFT",
              supplierId: form.supplierId || null,
              partyName: supName,
              sourceBillId: form.sourceBillId || null,
              sourceBillNo: form.sourceBillNo || null,
              warehouseId: form.warehouseId,
              receivableAccountId: recAccountId,
              inventoryAccountId: invAccountId,
              totalAmount,
              receivableBalance: 0,
              notes: form.notes,
            },
          ])
          .select()
          .single();
        if (insErr) throw insErr;
        docId = created.id;
      }

      const linePayloads = validLines.map((l) => ({
        returnId: docId,
        productId: l.productId,
        quantity: parseFloat(l.quantity),
        unitCost: parseFloat(l.unitCost) || 0,
        totalCost: l.totalCost,
        reason: l.reason,
      }));

      const { error: lErr } = await supabase
        .from("PurchaseReturnLine")
        .insert(linePayloads);
      if (lErr) throw lErr;

      if (targetStatus === "POSTED") {
        await executePostDocument(
          docId,
          docNumber,
          {
            ...form,
            partyName: supName,
            receivableAccountId: recAccountId,
            inventoryAccountId: invAccountId,
          },
          linePayloads,
          totalAmount
        );
        toast.success(
          `${docNumber} Posted! Receivable of ${currency} ${formatAmount(totalAmount)} recorded.`
        );
      } else {
        toast.success(`${docNumber} saved as Draft.`);
      }

      setShowModal(false);
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save document.");
    } finally {
      setSaving(false);
    }
  }

  async function executePostDocument(
    docId: string,
    docNumber: string,
    header: {
      docType: DocType;
      docDate: string;
      partyName: string;
      sourceBillNo: string;
      warehouseId: string;
      receivableAccountId: string;
      inventoryAccountId: string;
    },
    docLines: any[],
    totalVal: number
  ) {
    for (const line of docLines) {
      const deductQty = -Math.abs(Number(line.quantity));

      const { data: existingStock } = await supabase
        .from("Stock")
        .select("*")
        .eq("productId", line.productId)
        .eq("warehouseId", header.warehouseId)
        .maybeSingle();

      if (existingStock) {
        await supabase
          .from("Stock")
          .update({
            quantity: Number(existingStock.quantity || 0) + deductQty,
          })
          .eq("id", existingStock.id);
      } else {
        await supabase.from("Stock").insert([
          {
            productId: line.productId,
            warehouseId: header.warehouseId,
            quantity: deductQty,
            averageCost: Number(line.unitCost || 0),
          },
        ]);
      }

      await supabase.from("InventoryMovement").insert([
        {
          companyId,
          productId: line.productId,
          sourceWarehouseId: header.warehouseId,
          type: "ADJUSTMENT",
          referenceType: header.docType,
          referenceId: docId,
          quantity: deductQty,
          unitCost: Number(line.unitCost || 0),
          totalCost: Number(line.totalCost || 0),
          movementDate: new Date(header.docDate).toISOString(),
          notes: `${header.docType === "PURCHASE_RETURN" ? "Purchase Return" : "Transfer Out"} ${docNumber} (${header.partyName})`,
        },
      ]);
    }

    const entryNo = `${journalPrefix}${docNumber}`;
    const { data: journal, error: jErr } = await supabase
      .from("JournalEntry")
      .insert([
        {
          companyId,
          entryNo,
          entryNumber: entryNo,
          entryDate: new Date(header.docDate).toISOString(),
          description: `${
            header.docType === "PURCHASE_RETURN"
              ? "Purchase Return"
              : "Transfer Out"
          } ${docNumber} — Receivable from ${header.partyName}${
            header.sourceBillNo ? ` (Ref: ${header.sourceBillNo})` : ""
          }`,
          status: "POSTED",
          reference: docNumber,
          referenceType: header.docType,
          referenceId: docId,
        },
      ])
      .select()
      .single();

    if (jErr) throw jErr;

    const { error: jlErr } = await supabase.from("JournalLine").insert([
      {
        journalEntryId: journal.id,
        accountId: header.receivableAccountId,
        debit: totalVal,
        credit: 0,
        description: `Receivable for ${docNumber} (${header.partyName})`,
      },
      {
        journalEntryId: journal.id,
        accountId: header.inventoryAccountId,
        debit: 0,
        credit: totalVal,
        description: `Inventory stock reduction for ${docNumber}`,
      },
    ]);

    if (jlErr) throw jlErr;

    await supabase
      .from("PurchaseReturn")
      .update({
        status: "POSTED",
        receivableBalance: totalVal,
        journalId: journal.id,
      })
      .eq("id", docId);
  }

  async function handlePostRow(doc: any) {
    const docLines = linesByDoc[doc.id] || [];
    if (docLines.length === 0) {
      toast.error("Cannot post an empty document.");
      return;
    }
    try {
      setSaving(true);
      await executePostDocument(
        doc.id,
        doc.docNumber,
        {
          docType: doc.docType,
          docDate: doc.docDate,
          partyName: doc.partyName || "Counterparty",
          sourceBillNo: doc.sourceBillNo || "",
          warehouseId: doc.warehouseId,
          receivableAccountId:
            doc.receivableAccountId || resolvedAccounts.receivable?.id || "",
          inventoryAccountId:
            doc.inventoryAccountId || resolvedAccounts.inventory?.id || "",
        },
        docLines,
        Number(doc.totalAmount || 0)
      );
      toast.success(`${doc.docNumber} posted as Receivable!`);
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || "Failed to post document.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUnpostToDraft(doc: any) {
    if (
      !confirm(
        `Reverse ${doc.docNumber} back to DRAFT? This restores the inventory quantities and removes the Receivable Journal Entry so you can edit or delete it.`
      )
    )
      return;

    try {
      setSaving(true);
      const docLines = linesByDoc[doc.id] || [];

      for (const line of docLines) {
        const restoreQty = Math.abs(Number(line.quantity));
        const { data: existingStock } = await supabase
          .from("Stock")
          .select("*")
          .eq("productId", line.productId)
          .eq("warehouseId", doc.warehouseId)
          .maybeSingle();

        if (existingStock) {
          await supabase
            .from("Stock")
            .update({
              quantity: Number(existingStock.quantity || 0) + restoreQty,
            })
            .eq("id", existingStock.id);
        }
      }

      await supabase
        .from("InventoryMovement")
        .delete()
        .eq("referenceId", doc.id);

      if (doc.journalId) {
        await supabase.from("JournalEntry").delete().eq("id", doc.journalId);
      }

      await supabase
        .from("PurchaseReturn")
        .update({
          status: "DRAFT",
          receivableBalance: 0,
          journalId: null,
        })
        .eq("id", doc.id);

      toast.success(`${doc.docNumber} reverted to DRAFT.`);
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || "Failed to reverse document.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(doc: any) {
    if (doc.status === "POSTED") {
      toast.error("Click 'Unpost to Draft' first before deleting.");
      return;
    }
    if (!confirm(`Delete draft ${doc.docNumber}?`)) return;

    try {
      const { error } = await supabase
        .from("PurchaseReturn")
        .delete()
        .eq("id", doc.id);
      if (error) throw error;
      toast.success("Document deleted.");
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete.");
    }
  }

  function getAccountLabel(id: string) {
    const a = accounts.find((acc) => acc.id === id);
    return a ? `${a.code ? a.code + " - " : ""}${a.name}` : "Auto (Settings)";
  }

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (typeFilter !== "ALL" && r.docType !== typeFilter) return false;
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.docNumber?.toLowerCase().includes(q) ||
        r.partyName?.toLowerCase().includes(q) ||
        r.sourceBillNo?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q)
      );
    });
  }, [records, search, typeFilter, statusFilter]);

  const totalPostedReceivable = records
    .filter((r) => r.status === "POSTED")
    .reduce(
      (sum, r) => sum + Number(r.receivableBalance || r.totalAmount || 0),
      0
    );

  const cellPad = isCompact ? "py-2.5 px-4" : "py-3.5 px-5";

  return (
    <>
      <Toaster position="top-right" />
      <ERPShell title="Purchase Returns & Transfer Out">
        <div className="space-y-6 relative z-10">
          {/* Header Bar */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">
                <ShieldCheck className="w-3.5 h-3.5" /> Automated Accounting via Settings
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                Purchase Returns &amp; Transfer Out Invoices
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-zinc-400 mt-1">
                <span>
                  Receivable (Dr):{" "}
                  <strong className="text-slate-800 dark:text-zinc-200">
                    {resolvedAccounts.receivable
                      ? `${resolvedAccounts.receivable.code} - ${resolvedAccounts.receivable.name}`
                      : "Configure in Settings"}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Inventory (Cr):{" "}
                  <strong className="text-slate-800 dark:text-zinc-200">
                    {resolvedAccounts.inventory
                      ? `${resolvedAccounts.inventory.code} - ${resolvedAccounts.inventory.name}`
                      : "Configure in Settings"}
                  </strong>
                </span>
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 font-semibold hover:underline"
                >
                  <Settings2 className="w-3.5 h-3.5" /> Accounting Settings
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => openCreateModal("TRANSFER_OUT")}
                className="px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-600 hover:text-white text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Send className="w-4 h-4" /> + New Transfer Out
              </button>

              <button
                type="button"
                onClick={() => openCreateModal("PURCHASE_RETURN")}
                className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all"
              >
                <Undo2 className="w-4 h-4" /> + New Purchase Return
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-teal-200/80 dark:border-teal-500/20 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">
                  Total Active Receivable (Posted)
                </span>
                <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 mt-1.5">
                  {currency} {formatAmount(totalPostedReceivable)}
                </p>
                <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                  Owed back from posted returns &amp; transfers
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <Wallet className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  Purchase Returns
                </span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
                  {records.filter((r) => r.docType === "PURCHASE_RETURN").length}
                </p>
                <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                  Vendor stock returns
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <Undo2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  Transfer Out Invoices
                </span>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1.5">
                  {records.filter((r) => r.docType === "TRANSFER_OUT").length}
                </p>
                <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                  Outbound stock transfers
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Send className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filter & Register Table */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden">
            <div className="p-5 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search doc #, supplier/party, or source bill #..."
                  className="w-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:border-teal-500"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="ALL">All Document Types</option>
                <option value="PURCHASE_RETURN">Purchase Returns</option>
                <option value="TRANSFER_OUT">Transfer Out Invoices</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft Only</option>
                <option value="POSTED">Posted (Receivable)</option>
              </select>

              <button
                type="button"
                onClick={loadAllData}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-zinc-300 text-xs font-bold flex items-center gap-1.5"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-500" : ""}`}
                />{" "}
                Refresh
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 bg-slate-50/50 dark:bg-zinc-950/50">
                    <th className={cellPad}>Doc #</th>
                    <th className={cellPad}>Type</th>
                    <th className={cellPad}>Party / Source Invoice</th>
                    <th className={cellPad}>Auto-Posted Ledger Accounts</th>
                    <th className={`${cellPad} text-right`}>Receivable Amount</th>
                    <th className={`${cellPad} text-center`}>Status</th>
                    <th className={`${cellPad} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-14 text-center text-slate-400 animate-pulse">
                        Loading records...
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-14 text-center space-y-1">
                        <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                          No Purchase Returns or Transfer Out invoices yet
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-500">
                          Click &ldquo;+ New Purchase Return&rdquo; or &ldquo;+ New Transfer Out&rdquo; above to create one.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((doc) => {
                      const isPosted = doc.status === "POSTED";
                      return (
                        <tr
                          key={doc.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors"
                        >
                          <td className={`${cellPad} font-mono text-xs font-bold text-slate-900 dark:text-white`}>
                            {doc.docNumber}
                            <div className="text-[10px] font-normal text-slate-400">
                              {new Date(doc.docDate).toLocaleDateString()}
                            </div>
                          </td>
                          <td className={cellPad}>
                            {doc.docType === "PURCHASE_RETURN" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
                                Purchase Return
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30">
                                Transfer Out
                              </span>
                            )}
                          </td>
                          <td className={cellPad}>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {doc.partyName || "—"}
                            </div>
                            {doc.sourceBillNo && (
                              <span className="text-[11px] font-mono text-teal-600 dark:text-teal-400">
                                Against Bill: {doc.sourceBillNo}
                              </span>
                            )}
                          </td>
                          <td className={`${cellPad} text-xs`}>
                            <div className="text-emerald-700 dark:text-emerald-400 font-semibold">
                              Dr: {getAccountLabel(doc.receivableAccountId)}
                            </div>
                            <div className="text-slate-500 dark:text-zinc-400 text-[11px]">
                              Cr: {getAccountLabel(doc.inventoryAccountId)}
                            </div>
                          </td>
                          <td className={`${cellPad} text-right font-bold text-slate-900 dark:text-white whitespace-nowrap`}>
                            {currency} {formatAmount(doc.totalAmount)}
                            {isPosted && (
                              <span className="block text-[10px] text-teal-600 dark:text-teal-400 font-bold">
                                ACTIVE RECEIVABLE
                              </span>
                            )}
                          </td>
                          <td className={`${cellPad} text-center`}>
                            {isPosted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" /> POSTED
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                                DRAFT
                              </span>
                            )}
                          </td>
                          <td className={`${cellPad} text-right whitespace-nowrap space-x-1.5`}>
                            {!isPosted ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handlePostRow(doc)}
                                  disabled={saving}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-sm"
                                >
                                  <FileCheck className="w-3.5 h-3.5" /> Post
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(doc)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 text-xs font-semibold"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(doc)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50/50 dark:bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 text-xs font-semibold"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleUnpostToDraft(doc)}
                                disabled={saving}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-700 dark:text-amber-400 text-xs font-bold transition-all"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Unpost to Draft
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* MODAL: CREATE / EDIT PURCHASE RETURN OR TRANSFER OUT (NO ACCOUNT SELECTION NEEDED) */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingDoc
                      ? `Edit ${editingDoc.docNumber}`
                      : form.docType === "PURCHASE_RETURN"
                      ? "New Purchase Return Invoice"
                      : "New Transfer Out Invoice"}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Ledger accounts are automatically handled by your Accounting Settings.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Document Type Toggle */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, docType: "PURCHASE_RETURN" })}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    form.docType === "PURCHASE_RETURN"
                      ? "bg-teal-50 dark:bg-teal-500/15 border-teal-500 text-teal-800 dark:text-teal-300"
                      : "bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-white/10 text-slate-500"
                  }`}
                >
                  <Undo2 className="w-4 h-4" /> Purchase Return (Against Supplier / Bill)
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, docType: "TRANSFER_OUT" })}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    form.docType === "TRANSFER_OUT"
                      ? "bg-indigo-50 dark:bg-indigo-500/15 border-indigo-500 text-indigo-800 dark:text-indigo-300"
                      : "bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-white/10 text-slate-500"
                  }`}
                >
                  <Send className="w-4 h-4" /> Transfer Out Invoice (Receivable Transfer)
                </button>
              </div>

              {/* Header Form */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Link Original Purchase Bill (Optional)
                  </label>
                  <select
                    value={form.sourceBillId}
                    onChange={(e) => handleSelectSourceBill(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 outline-none focus:border-teal-500"
                  >
                    <option value="">-- Select Bill to Auto-Fill --</option>
                    {purchaseBills.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.billNo} ({currency} {formatAmount(b.total)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Supplier / Counterparty
                  </label>
                  <select
                    value={form.supplierId}
                    onChange={(e) => {
                      const sup = suppliers.find((s) => s.id === e.target.value);
                      setForm({
                        ...form,
                        supplierId: e.target.value,
                        partyName: sup?.name || form.partyName,
                      });
                    }}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 outline-none focus:border-teal-500"
                  >
                    <option value="">-- Select Supplier or Enter Below --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Party / Branch Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Supplier or receiving party name"
                    value={form.partyName}
                    onChange={(e) => setForm({ ...form, partyName: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Document Date *
                  </label>
                  <input
                    type="date"
                    value={form.docDate}
                    onChange={(e) => setForm({ ...form, docDate: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Source Warehouse (Stock Out) *
                  </label>
                  <select
                    value={form.warehouseId}
                    onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 outline-none focus:border-teal-500"
                  >
                    <option value="">Select Warehouse...</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Notes / Reference
                  </label>
                  <input
                    type="text"
                    placeholder="Optional return reason or gatepass #"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Line Items Table */}
              <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-white/10 text-[10px] font-bold uppercase text-slate-500">
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3 text-center">On-Hand</th>
                      <th className="py-2.5 px-3 text-center">Return / Out Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Cost ({currency})</th>
                      <th className="py-2.5 px-3 text-right">Line Receivable</th>
                      <th className="py-2.5 px-3">Reason</th>
                      <th className="py-2.5 px-2 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                    {lines.map((line) => {
                      const info = getStockInfo(line.productId, form.warehouseId);
                      return (
                        <tr key={line.id}>
                          <td className="p-2 min-w-[200px]">
                            <select
                              value={line.productId}
                              onChange={(e) =>
                                updateLine(line.id, "productId", e.target.value)
                              }
                              className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2 outline-none focus:border-teal-500"
                            >
                              <option value="">Select Product...</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.sku})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2 text-center font-mono text-slate-500">
                            {line.productId ? info.onHand : "—"}
                          </td>
                          <td className="p-2 w-28">
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              value={line.quantity}
                              onChange={(e) =>
                                updateLine(line.id, "quantity", e.target.value)
                              }
                              className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2 text-center font-bold outline-none focus:border-teal-500"
                            />
                          </td>
                          <td className="p-2 w-32">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={line.unitCost}
                              onChange={(e) =>
                                updateLine(line.id, "unitCost", e.target.value)
                              }
                              className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2 text-right font-semibold outline-none focus:border-teal-500"
                            />
                          </td>
                          <td className="p-2 text-right font-bold text-teal-600 dark:text-teal-400 whitespace-nowrap">
                            {currency} {formatAmount(line.totalCost)}
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              placeholder="Reason..."
                              value={line.reason}
                              onChange={(e) =>
                                updateLine(line.id, "reason", e.target.value)
                              }
                              className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2 outline-none focus:border-teal-500"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeLine(line.id)}
                              className="text-slate-400 hover:text-rose-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="p-3 bg-slate-50/60 dark:bg-zinc-950/50 border-t border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={addLine}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:border-teal-500"
                  >
                    + Add Line Item
                  </button>

                  <div className="flex items-center gap-2 text-xs font-bold text-teal-700 dark:text-teal-300">
                    <Scale className="w-4 h-4" /> Total Receivable Amount:{" "}
                    <span className="text-sm">
                      {currency} {formatAmount(totalAmount)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave("DRAFT")}
                  className="px-5 py-2.5 rounded-xl border border-teal-500/40 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 text-xs font-bold hover:bg-teal-100 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save as Draft"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave("POSTED")}
                  className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-teal-500/20 disabled:opacity-50"
                >
                  {saving ? "Posting..." : "Save & Post Receivable"}
                </button>
              </div>
            </div>
          </div>
        )}
      </ERPShell>
    </>
  );
}