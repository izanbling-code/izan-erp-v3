"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Toaster, toast } from "react-hot-toast";
import ERPShell from "@/app/components/erp-shell";
import { supabase } from "@/app/lib/supabase";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import {
  Plus,
  Search,
  RefreshCw,
  Edit3,
  Trash2,
  CheckCircle2,
  RotateCcw,
  ArrowLeftRight,
  AlertTriangle,
  Flame,
  Sparkles,
  FileCheck,
  Scale,
  X,
} from "lucide-react";

type AdjustmentType = "DAMAGE" | "LOST" | "RECLASSIFY" | "SURPLUS";
type AdjustmentStatus = "DRAFT" | "POSTED" | "VOID";

type LineForm = {
  id: string;
  productId: string;
  direction: "OUT" | "IN";
  quantity: string;
  unitCost: string;
  totalCost: number;
  reason: string;
};

const TYPE_META: Record<
  AdjustmentType,
  { label: string; badge: string; desc: string; icon: any }
> = {
  DAMAGE: {
    label: "Damaged Stock",
    badge:
      "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30",
    desc: "Write off broken, defective, or damaged units from inventory.",
    icon: Flame,
  },
  LOST: {
    label: "Lost / Shrinkage",
    badge:
      "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
    desc: "Record missing or unaccounted inventory shrinkage.",
    icon: AlertTriangle,
  },
  RECLASSIFY: {
    label: "Mixed Item Transfer",
    badge:
      "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30",
    desc: "Move quantities from one item to another when items get mixed.",
    icon: ArrowLeftRight,
  },
  SURPLUS: {
    label: "Surplus / Found",
    badge:
      "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30",
    desc: "Add positive found stock into warehouse inventory.",
    icon: Sparkles,
  },
};

export default function StockAdjustmentsPage() {
  const { settings, formatAmount, currency } = useERPConfig();
  const isCompact = settings?.appearance?.dataDensity === "compact";

  const [companyId, setCompanyId] = useState("001");
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [linesByAdj, setLinesByAdj] = useState<Record<string, any[]>>({});
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AdjustmentStatus>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | AdjustmentType>("ALL");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingAdj, setEditingAdj] = useState<any | null>(null);

  const defaultInvAccountId = settings?.accounting?.defaultInventoryAccountId || "";
  const defaultCogsAccountId =
    settings?.accounting?.defaultCogsAccountId ||
    settings?.accounting?.discountAccountId ||
    "";
  const journalPrefix = settings?.numbering?.journalPrefix || "JE-";

  const [form, setForm] = useState({
    adjustmentDate: new Date().toISOString().split("T")[0],
    type: "DAMAGE" as AdjustmentType,
    warehouseId: "",
    inventoryAccountId: "",
    offsetAccountId: "",
    notes: "",
  });

  const [lines, setLines] = useState<LineForm[]>([]);

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

      const [adjRes, lineRes, prodRes, whRes, stkRes] = await Promise.all([
        supabase
          .from("StockAdjustment")
          .select("*")
          .order("adjustmentDate", { ascending: false }),
        supabase.from("StockAdjustmentLine").select("*"),
        supabase.from("Product").select("*").order("name"),
        supabase.from("Warehouse").select("*").order("name"),
        supabase.from("Stock").select("*"),
      ]);

      let coaList: any[] = [];
      try {
        const r = await fetch("/api/accounts");
        const d = await r.json();
        coaList = d.accounts || (Array.isArray(d) ? d : []);
      } catch {
        const { data: accs } = await supabase.from("Account").select("*").order("code");
        coaList = accs || [];
      }

      const groupedLines: Record<string, any[]> = {};
      (lineRes.data || []).forEach((l: any) => {
        if (!groupedLines[l.adjustmentId]) groupedLines[l.adjustmentId] = [];
        groupedLines[l.adjustmentId].push(l);
      });

      setAdjustments(adjRes.data || []);
      setLinesByAdj(groupedLines);
      setProducts(prodRes.data || []);
      setWarehouses(whRes.data || []);
      setStocks(stkRes.data || []);
      setAccounts(coaList);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load stock adjustments.");
    } finally {
      setLoading(false);
    }
  }

  function getStockInfo(productId: string, warehouseId: string) {
    const record = stocks.find(
      (s) => s.productId === productId && s.warehouseId === warehouseId
    );
    const prod = products.find((p) => p.id === productId);
    return {
      onHand: Number(record?.quantity || 0),
      avgCost: Number(record?.averageCost || prod?.costPrice || 0),
    };
  }

  function openCreateModal(initialType: AdjustmentType = "DAMAGE") {
    const whId = warehouses[0]?.id || "";
    const invAcc =
      defaultInvAccountId ||
      accounts.find((a) => a.type === "ASSET" && a.name.toLowerCase().includes("inventory"))?.id ||
      accounts[0]?.id ||
      "";
    const expAcc =
      defaultCogsAccountId ||
      accounts.find((a) => a.type === "EXPENSE")?.id ||
      accounts[0]?.id ||
      "";

    setEditingAdj(null);
    setForm({
      adjustmentDate: new Date().toISOString().split("T")[0],
      type: initialType,
      warehouseId: whId,
      inventoryAccountId: invAcc,
      offsetAccountId: expAcc,
      notes: "",
    });

    if (initialType === "RECLASSIFY") {
      setLines([
        {
          id: crypto.randomUUID(),
          productId: "",
          direction: "OUT",
          quantity: "1",
          unitCost: "0",
          totalCost: 0,
          reason: "Mixed stock transferred out",
        },
        {
          id: crypto.randomUUID(),
          productId: "",
          direction: "IN",
          quantity: "1",
          unitCost: "0",
          totalCost: 0,
          reason: "Mixed stock transferred in",
        },
      ]);
    } else {
      setLines([
        {
          id: crypto.randomUUID(),
          productId: "",
          direction: initialType === "SURPLUS" ? "IN" : "OUT",
          quantity: "1",
          unitCost: "0",
          totalCost: 0,
          reason: "",
        },
      ]);
    }
    setShowModal(true);
  }

  function openEditModal(adj: any) {
    if (adj.status === "POSTED") {
      toast.error("Posted adjustments are locked. Click 'Unpost to Draft' first to edit.");
      return;
    }
    setEditingAdj(adj);
    setForm({
      adjustmentDate: new Date(adj.adjustmentDate).toISOString().split("T")[0],
      type: (adj.type as AdjustmentType) || "DAMAGE",
      warehouseId: adj.warehouseId || warehouses[0]?.id || "",
      inventoryAccountId: adj.inventoryAccountId || defaultInvAccountId,
      offsetAccountId: adj.offsetAccountId || defaultCogsAccountId,
      notes: adj.notes || "",
    });

    const existingLines = (linesByAdj[adj.id] || []).map((l: any) => ({
      id: l.id,
      productId: l.productId,
      direction: (l.direction as "OUT" | "IN") || "OUT",
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
              direction: adj.type === "SURPLUS" ? "IN" : "OUT",
              quantity: "1",
              unitCost: "0",
              totalCost: 0,
              reason: "",
            },
          ]
    );
    setShowModal(true);
  }

  function handleTypeChange(newType: AdjustmentType) {
    setForm((prev) => ({ ...prev, type: newType }));
    if (newType === "RECLASSIFY" && lines.length < 2) {
      setLines([
        {
          id: crypto.randomUUID(),
          productId: lines[0]?.productId || "",
          direction: "OUT",
          quantity: lines[0]?.quantity || "1",
          unitCost: lines[0]?.unitCost || "0",
          totalCost: lines[0]?.totalCost || 0,
          reason: "Source item (Deduct)",
        },
        {
          id: crypto.randomUUID(),
          productId: "",
          direction: "IN",
          quantity: lines[0]?.quantity || "1",
          unitCost: lines[0]?.unitCost || "0",
          totalCost: lines[0]?.totalCost || 0,
          reason: "Target item (Add)",
        },
      ]);
    } else if (newType !== "RECLASSIFY") {
      const dir = newType === "SURPLUS" ? "IN" : "OUT";
      setLines((prev) => prev.map((l) => ({ ...l, direction: dir })));
    }
  }

  function updateLine(id: string, field: keyof LineForm, value: string) {
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

  function addLine(direction: "OUT" | "IN" = "OUT") {
    setLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        productId: "",
        direction: form.type === "RECLASSIFY" ? direction : form.type === "SURPLUS" ? "IN" : "OUT",
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

  // Balance Calculations
  const totalOutValue = useMemo(
    () =>
      lines
        .filter((l) => l.direction === "OUT")
        .reduce((sum, l) => sum + Number(l.totalCost || 0), 0),
    [lines]
  );

  const totalInValue = useMemo(
    () =>
      lines
        .filter((l) => l.direction === "IN")
        .reduce((sum, l) => sum + Number(l.totalCost || 0), 0),
    [lines]
  );

  const netAdjustmentValue =
    form.type === "RECLASSIFY"
      ? Math.max(totalOutValue, totalInValue)
      : form.type === "SURPLUS"
      ? totalInValue
      : totalOutValue;

  const reclassifyVariance = Math.abs(totalOutValue - totalInValue);

  // Match Target Cost to Source Cost automatically for Mixed Items
  function matchReclassifyCost() {
    const inLines = lines.filter((l) => l.direction === "IN");
    if (inLines.length === 0 || totalOutValue <= 0) return;
    const perLineValue = totalOutValue / inLines.length;

    setLines((prev) =>
      prev.map((l) => {
        if (l.direction !== "IN") return l;
        const qty = parseFloat(l.quantity) || 1;
        const newUnitCost = (perLineValue / qty).toFixed(2);
        return {
          ...l,
          unitCost: newUnitCost,
          totalCost: Number((qty * parseFloat(newUnitCost)).toFixed(2)),
        };
      })
    );
    toast.success("Target item cost balanced to match source item value!");
  }

  // Save as DRAFT or Save & POST
  async function handleSave(targetStatus: "DRAFT" | "POSTED") {
    const validLines = lines.filter((l) => l.productId && parseFloat(l.quantity) > 0);
    if (!form.warehouseId) {
      toast.error("Please select a warehouse.");
      return;
    }
    if (validLines.length === 0) {
      toast.error("Please add at least one product line with quantity > 0.");
      return;
    }
    if (form.type === "RECLASSIFY") {
      const hasOut = validLines.some((l) => l.direction === "OUT");
      const hasIn = validLines.some((l) => l.direction === "IN");
      if (!hasOut || !hasIn) {
        toast.error("Mixed item reclassification requires at least one Source (OUT) and one Target (IN) item.");
        return;
      }
      if (reclassifyVariance > 0.05) {
        toast.error("For mixed items, Total OUT Value must equal Total IN Value so the entry is balanced.");
        return;
      }
    }
    if (targetStatus === "POSTED" && (!form.inventoryAccountId || !form.offsetAccountId)) {
      toast.error("Please select both Inventory Asset and Offset/Expense GL Accounts to post.");
      return;
    }

    setSaving(true);
    try {
      const adjNo =
        editingAdj?.adjustmentNo ||
        `ADJ-${String(adjustments.length + 1).padStart(4, "0")}`;

      let adjId = editingAdj?.id;

      if (editingAdj) {
        const { error: updErr } = await supabase
          .from("StockAdjustment")
          .update({
            adjustmentDate: new Date(form.adjustmentDate).toISOString(),
            type: form.type,
            warehouseId: form.warehouseId,
            inventoryAccountId: form.inventoryAccountId,
            offsetAccountId: form.offsetAccountId,
            totalValue: netAdjustmentValue,
            notes: form.notes,
            updatedAt: new Date().toISOString(),
          })
          .eq("id", adjId);
        if (updErr) throw updErr;

        await supabase.from("StockAdjustmentLine").delete().eq("adjustmentId", adjId);
      } else {
        const { data: created, error: insErr } = await supabase
          .from("StockAdjustment")
          .insert([
            {
              companyId,
              adjustmentNo: adjNo,
              adjustmentDate: new Date(form.adjustmentDate).toISOString(),
              type: form.type,
              status: "DRAFT",
              warehouseId: form.warehouseId,
              inventoryAccountId: form.inventoryAccountId,
              offsetAccountId: form.offsetAccountId,
              totalValue: netAdjustmentValue,
              notes: form.notes,
            },
          ])
          .select()
          .single();
        if (insErr) throw insErr;
        adjId = created.id;
      }

      const linePayloads = validLines.map((l) => ({
        adjustmentId: adjId,
        productId: l.productId,
        direction: l.direction,
        quantity: parseFloat(l.quantity),
        unitCost: parseFloat(l.unitCost) || 0,
        totalCost: l.totalCost,
        reason: l.reason,
      }));

      const { error: lErr } = await supabase.from("StockAdjustmentLine").insert(linePayloads);
      if (lErr) throw lErr;

      if (targetStatus === "POSTED") {
        await executePostAdjustment(adjId, adjNo, form, linePayloads, netAdjustmentValue);
        toast.success(`Adjustment ${adjNo} posted to Stock & General Ledger!`);
      } else {
        toast.success(`Adjustment ${adjNo} saved as Draft.`);
      }

      setShowModal(false);
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save adjustment.");
    } finally {
      setSaving(false);
    }
  }

  // Post a Draft Adjustment (Updates Stock + InventoryMovement + Balanced JournalEntry)
  async function executePostAdjustment(
    adjId: string,
    adjNo: string,
    header: typeof form,
    adjLines: any[],
    totalVal: number
  ) {
    // 1. Update Stock quantities & create InventoryMovements
    for (const line of adjLines) {
      const isAdd = line.direction === "IN";
      const signedQty = isAdd ? Number(line.quantity) : -Number(line.quantity);

      const { data: existingStock } = await supabase
        .from("Stock")
        .select("*")
        .eq("productId", line.productId)
        .eq("warehouseId", header.warehouseId)
        .maybeSingle();

      if (existingStock) {
        const oldQty = Number(existingStock.quantity || 0);
        const oldAvg = Number(existingStock.averageCost || 0);
        const newQty = oldQty + signedQty;
        const newAvg =
          isAdd && newQty > 0
            ? (oldQty * oldAvg + Number(line.quantity) * Number(line.unitCost)) / newQty
            : oldAvg;

        await supabase
          .from("Stock")
          .update({ quantity: newQty, averageCost: newAvg })
          .eq("id", existingStock.id);
      } else {
        await supabase.from("Stock").insert([
          {
            productId: line.productId,
            warehouseId: header.warehouseId,
            quantity: signedQty,
            averageCost: Number(line.unitCost || 0),
          },
        ]);
      }

      await supabase.from("InventoryMovement").insert([
        {
          companyId,
          productId: line.productId,
          sourceWarehouseId: !isAdd ? header.warehouseId : null,
          destinationWarehouseId: isAdd ? header.warehouseId : null,
          type: "ADJUSTMENT",
          referenceType: "STOCK_ADJUSTMENT",
          referenceId: adjId,
          quantity: signedQty,
          unitCost: Number(line.unitCost || 0),
          totalCost: Number(line.totalCost || 0),
          movementDate: new Date(header.adjustmentDate).toISOString(),
          notes: `${header.type} (${adjNo}) ${line.reason ? "- " + line.reason : ""}`,
        },
      ]);
    }

    // 2. Post Balanced Double-Entry Journal to General Ledger
    let journalId: string | null = null;
    if (totalVal > 0 && header.inventoryAccountId && header.offsetAccountId) {
      const entryNo = `${journalPrefix}${adjNo}`;
      const { data: journal, error: jErr } = await supabase
        .from("JournalEntry")
        .insert([
          {
            companyId,
            entryNo,
            entryNumber: entryNo,
            entryDate: new Date(header.adjustmentDate).toISOString(),
            description: `Stock Adjustment ${adjNo} (${TYPE_META[header.type].label})`,
            status: "POSTED",
            reference: adjNo,
            referenceType: "STOCK_ADJUSTMENT",
            referenceId: adjId,
          },
        ])
        .select()
        .single();

      if (jErr) throw jErr;
      journalId = journal.id;

      let jLines: any[] = [];
      if (header.type === "DAMAGE" || header.type === "LOST") {
        // Debit Expense/Shrinkage, Credit Inventory Asset
        jLines = [
          {
            journalEntryId: journal.id,
            accountId: header.offsetAccountId,
            debit: totalVal,
            credit: 0,
            description: `${TYPE_META[header.type].label} write-off (${adjNo})`,
          },
          {
            journalEntryId: journal.id,
            accountId: header.inventoryAccountId,
            debit: 0,
            credit: totalVal,
            description: `Inventory reduction (${adjNo})`,
          },
        ];
      } else if (header.type === "SURPLUS") {
        // Debit Inventory Asset, Credit Offset Account
        jLines = [
          {
            journalEntryId: journal.id,
            accountId: header.inventoryAccountId,
            debit: totalVal,
            credit: 0,
            description: `Surplus stock found (${adjNo})`,
          },
          {
            journalEntryId: journal.id,
            accountId: header.offsetAccountId,
            debit: 0,
            credit: totalVal,
            description: `Surplus stock gain (${adjNo})`,
          },
        ];
      } else if (header.type === "RECLASSIFY") {
        // Debit Target Inventory Asset, Credit Source Inventory Asset (100% Balanced Reclassification)
        jLines = [
          {
            journalEntryId: journal.id,
            accountId: header.inventoryAccountId,
            debit: totalVal,
            credit: 0,
            description: `Reclassified stock IN (${adjNo})`,
          },
          {
            journalEntryId: journal.id,
            accountId: header.inventoryAccountId,
            debit: 0,
            credit: totalVal,
            description: `Reclassified stock OUT (${adjNo})`,
          },
        ];
      }

      const { error: jlErr } = await supabase.from("JournalLine").insert(jLines);
      if (jlErr) throw jlErr;
    }

    await supabase
      .from("StockAdjustment")
      .update({ status: "POSTED", journalId })
      .eq("id", adjId);
  }

  // Post Directly from Table Row
  async function handlePostRow(adj: any) {
    const adjLines = linesByAdj[adj.id] || [];
    if (adjLines.length === 0) {
      toast.error("Cannot post an empty adjustment.");
      return;
    }
    try {
      setSaving(true);
      await executePostAdjustment(
        adj.id,
        adj.adjustmentNo,
        {
          adjustmentDate: adj.adjustmentDate,
          type: adj.type,
          warehouseId: adj.warehouseId,
          inventoryAccountId: adj.inventoryAccountId || defaultInvAccountId,
          offsetAccountId: adj.offsetAccountId || defaultCogsAccountId,
          notes: adj.notes || "",
        },
        adjLines,
        Number(adj.totalValue || 0)
      );
      toast.success(`Adjustment ${adj.adjustmentNo} posted!`);
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || "Failed to post adjustment.");
    } finally {
      setSaving(false);
    }
  }

  // Reverse Posted Adjustment back to DRAFT (So it can be edited or deleted safely)
  async function handleUnpostToDraft(adj: any) {
    if (
      !confirm(
        `Reverse ${adj.adjustmentNo} back to DRAFT? This will restore the stock quantities and remove its General Ledger Journal Entry so you can edit or delete it.`
      )
    )
      return;

    try {
      setSaving(true);
      const adjLines = linesByAdj[adj.id] || [];

      for (const line of adjLines) {
        const wasAdd = line.direction === "IN";
        const reverseQty = wasAdd ? -Number(line.quantity) : Number(line.quantity);

        const { data: existingStock } = await supabase
          .from("Stock")
          .select("*")
          .eq("productId", line.productId)
          .eq("warehouseId", adj.warehouseId)
          .maybeSingle();

        if (existingStock) {
          await supabase
            .from("Stock")
            .update({ quantity: Number(existingStock.quantity || 0) + reverseQty })
            .eq("id", existingStock.id);
        }
      }

      await supabase
        .from("InventoryMovement")
        .delete()
        .eq("referenceType", "STOCK_ADJUSTMENT")
        .eq("referenceId", adj.id);

      if (adj.journalId) {
        await supabase.from("JournalEntry").delete().eq("id", adj.journalId);
      }

      await supabase
        .from("StockAdjustment")
        .update({ status: "DRAFT", journalId: null })
        .eq("id", adj.id);

      toast.success(`${adj.adjustmentNo} reverted to DRAFT. You can now edit or delete it.`);
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || "Failed to unpost adjustment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(adj: any) {
    if (adj.status === "POSTED") {
      toast.error("Please click 'Unpost to Draft' before deleting a posted adjustment.");
      return;
    }
    if (!confirm(`Delete draft adjustment ${adj.adjustmentNo}?`)) return;

    try {
      const { error } = await supabase.from("StockAdjustment").delete().eq("id", adj.id);
      if (error) throw error;
      toast.success("Adjustment deleted.");
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || "Delete failed.");
    }
  }

  const filteredAdjustments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return adjustments.filter((a) => {
      if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && a.type !== typeFilter) return false;
      if (!q) return true;
      return (
        a.adjustmentNo?.toLowerCase().includes(q) ||
        a.notes?.toLowerCase().includes(q) ||
        a.type?.toLowerCase().includes(q)
      );
    });
  }, [adjustments, search, statusFilter, typeFilter]);

  const cellPad = isCompact ? "py-2.5 px-4" : "py-3.5 px-5";

  return (
    <>
      <Toaster position="top-right" />
      <ERPShell title="Stock Adjustments & Reclassification">
        <div className="space-y-6 relative z-10">
          {/* Header Bar */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">
                Inventory Control &amp; Double-Entry Balancing
              </span>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                Stock Adjustments &amp; Mixed Item Reclassification
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Record damaged or lost inventory, or transfer quantities between mixed items with balanced General Ledger entries.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => openCreateModal("RECLASSIFY")}
                className="px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-600 hover:text-white text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <ArrowLeftRight className="w-4 h-4" /> Move Mixed Stock
              </button>

              <button
                type="button"
                onClick={() => openCreateModal("DAMAGE")}
                className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all"
              >
                <Plus className="w-4 h-4" /> New Stock Adjustment
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5">
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                Total Adjustments
              </span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
                {adjustments.length}
              </p>
              <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                {adjustments.filter((a) => a.status === "DRAFT").length} Draft •{" "}
                {adjustments.filter((a) => a.status === "POSTED").length} Posted
              </span>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5">
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">
                Damaged &amp; Lost Write-Offs
              </span>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1.5">
                {currency}{" "}
                {formatAmount(
                  adjustments
                    .filter(
                      (a) =>
                        a.status === "POSTED" && (a.type === "DAMAGE" || a.type === "LOST")
                    )
                    .reduce((s, a) => s + Number(a.totalValue || 0), 0)
                )}
              </p>
              <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                Posted shrinkage value
              </span>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5">
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                Mixed Item Transfers
              </span>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1.5">
                {adjustments.filter((a) => a.type === "RECLASSIFY").length}
              </p>
              <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                Item-to-item reclassifications
              </span>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                Surplus / Found Stock
              </span>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
                {currency}{" "}
                {formatAmount(
                  adjustments
                    .filter((a) => a.status === "POSTED" && a.type === "SURPLUS")
                    .reduce((s, a) => s + Number(a.totalValue || 0), 0)
                )}
              </p>
              <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                Positive stock recoveries
              </span>
            </div>
          </div>

          {/* Filter & Table Card */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden">
            <div className="p-5 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search adjustment #, reason, or notes..."
                  className="w-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:border-teal-500"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="ALL">All Adjustment Types</option>
                <option value="DAMAGE">Damaged Stock</option>
                <option value="LOST">Lost / Shrinkage</option>
                <option value="RECLASSIFY">Mixed Item Transfer</option>
                <option value="SURPLUS">Surplus / Found</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft Only</option>
                <option value="POSTED">Posted Only</option>
              </select>

              <button
                type="button"
                onClick={loadAllData}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-zinc-300 text-xs font-bold flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-500" : ""}`} />{" "}
                Refresh
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 bg-slate-50/50 dark:bg-zinc-950/50">
                    <th className={cellPad}>Adj #</th>
                    <th className={cellPad}>Date</th>
                    <th className={cellPad}>Type</th>
                    <th className={cellPad}>Warehouse</th>
                    <th className={cellPad}>Items Summary</th>
                    <th className={`${cellPad} text-right`}>Balanced Value</th>
                    <th className={`${cellPad} text-center`}>Status</th>
                    <th className={`${cellPad} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-14 text-center text-slate-400 animate-pulse">
                        Loading stock adjustments...
                      </td>
                    </tr>
                  ) : filteredAdjustments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-14 text-center space-y-1">
                        <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                          No stock adjustments recorded yet
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-500">
                          Click &ldquo;+ New Stock Adjustment&rdquo; or &ldquo;Move Mixed Stock&rdquo; above to begin.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredAdjustments.map((adj) => {
                      const meta = TYPE_META[(adj.type as AdjustmentType) || "DAMAGE"];
                      const wh = warehouses.find((w) => w.id === adj.warehouseId);
                      const itemLines = linesByAdj[adj.id] || [];
                      const isPosted = adj.status === "POSTED";

                      return (
                        <tr
                          key={adj.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors"
                        >
                          <td className={`${cellPad} font-mono text-xs font-bold text-slate-900 dark:text-white`}>
                            {adj.adjustmentNo}
                          </td>
                          <td className={`${cellPad} text-slate-600 dark:text-zinc-300 whitespace-nowrap`}>
                            {new Date(adj.adjustmentDate).toLocaleDateString()}
                          </td>
                          <td className={cellPad}>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${meta.badge}`}
                            >
                              {meta.label}
                            </span>
                          </td>
                          <td className={`${cellPad} text-xs font-semibold text-slate-700 dark:text-zinc-300`}>
                            {wh?.name || "Main Warehouse"}
                          </td>
                          <td className={cellPad}>
                            <div className="text-xs text-slate-800 dark:text-zinc-200 space-y-0.5">
                              {itemLines.map((l: any) => {
                                const p = products.find((prod) => prod.id === l.productId);
                                return (
                                  <div key={l.id} className="flex items-center gap-1.5">
                                    <span
                                      className={`font-mono font-bold text-[11px] ${
                                        l.direction === "IN"
                                          ? "text-emerald-600 dark:text-emerald-400"
                                          : "text-rose-600 dark:text-rose-400"
                                      }`}
                                    >
                                      {l.direction === "IN" ? `+${l.quantity}` : `-${l.quantity}`}
                                    </span>
                                    <span className="truncate max-w-[180px]">
                                      {p?.name || "Item"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            {adj.notes && (
                              <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                                {adj.notes}
                              </div>
                            )}
                          </td>
                          <td className={`${cellPad} text-right font-bold text-slate-900 dark:text-white whitespace-nowrap`}>
                            {currency} {formatAmount(adj.totalValue || 0)}
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
                                  onClick={() => handlePostRow(adj)}
                                  disabled={saving}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-sm"
                                >
                                  <FileCheck className="w-3.5 h-3.5" /> Post
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(adj)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 text-xs font-semibold"
                                  title="Edit Draft"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(adj)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50/50 dark:bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 text-xs font-semibold"
                                  title="Delete Draft"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleUnpostToDraft(adj)}
                                disabled={saving}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-700 dark:text-amber-400 text-xs font-bold transition-all"
                                title="Reverse to Draft to Edit or Delete"
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

        {/* CREATE / EDIT ADJUSTMENT MODAL */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingAdj
                      ? `Edit Stock Adjustment (${editingAdj.adjustmentNo})`
                      : "New Balanced Stock Adjustment"}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    {TYPE_META[form.type].desc}
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

              {/* Type Selector Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {(Object.keys(TYPE_META) as AdjustmentType[]).map((tKey) => {
                  const active = form.type === tKey;
                  const Icon = TYPE_META[tKey].icon;
                  return (
                    <button
                      key={tKey}
                      type="button"
                      onClick={() => handleTypeChange(tKey)}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                        active
                          ? "bg-teal-50 dark:bg-teal-500/15 border-teal-500 text-teal-800 dark:text-teal-300 shadow-sm"
                          : "bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:bg-slate-100"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-bold">{TYPE_META[tKey].label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Adjustment Date *
                  </label>
                  <input
                    type="date"
                    value={form.adjustmentDate}
                    onChange={(e) => setForm({ ...form, adjustmentDate: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-xs outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Warehouse *
                  </label>
                  <select
                    value={form.warehouseId}
                    onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-xs outline-none focus:border-teal-500"
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
                    Inventory Asset Account (GL) *
                  </label>
                  <select
                    value={form.inventoryAccountId}
                    onChange={(e) => setForm({ ...form, inventoryAccountId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-xs outline-none focus:border-teal-500"
                  >
                    <option value="">Select Inventory Account...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Offset / Shrinkage Expense (GL) *
                  </label>
                  <select
                    value={form.offsetAccountId}
                    onChange={(e) => setForm({ ...form, offsetAccountId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-xs outline-none focus:border-teal-500"
                  >
                    <option value="">Select Offset Account...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Lines Table */}
              <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-white/10 text-[10px] font-bold uppercase text-slate-500">
                      <th className="py-2.5 px-3">Direction</th>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3 text-center">On-Hand</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Cost ({currency})</th>
                      <th className="py-2.5 px-3 text-right">Total Value</th>
                      <th className="py-2.5 px-3">Line Note</th>
                      <th className="py-2.5 px-2 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                    {lines.map((line) => {
                      const stockInfo = getStockInfo(line.productId, form.warehouseId);
                      return (
                        <tr key={line.id}>
                          <td className="p-2">
                            {form.type === "RECLASSIFY" ? (
                              <select
                                value={line.direction}
                                onChange={(e) =>
                                  updateLine(line.id, "direction", e.target.value)
                                }
                                className={`rounded-lg px-2.5 py-1.5 font-bold text-xs border outline-none ${
                                  line.direction === "OUT"
                                    ? "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30"
                                    : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30"
                                }`}
                              >
                                <option value="OUT">OUT (From Item)</option>
                                <option value="IN">IN (To Item)</option>
                              </select>
                            ) : (
                              <span
                                className={`inline-block px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                                  line.direction === "IN"
                                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                    : "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400"
                                }`}
                              >
                                {line.direction === "IN" ? "+ ADD" : "- DEDUCT"}
                              </span>
                            )}
                          </td>

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
                            {line.productId ? stockInfo.onHand : "—"}
                          </td>

                          <td className="p-2 w-24">
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

                          <td className="p-2 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {currency} {formatAmount(line.totalCost)}
                          </td>

                          <td className="p-2">
                            <input
                              type="text"
                              placeholder="Reason..."
                              value={line.reason}
                              onChange={(e) => updateLine(line.id, "reason", e.target.value)}
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
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => addLine("OUT")}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:border-teal-500"
                    >
                      + Add Row
                    </button>
                    {form.type === "RECLASSIFY" && (
                      <button
                        type="button"
                        onClick={matchReclassifyCost}
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold"
                      >
                        Auto-Balance Target Cost to Source Value
                      </button>
                    )}
                  </div>

                  {/* Double-Entry Balance Bar */}
                  <div className="flex items-center gap-4 text-xs">
                    {form.type === "RECLASSIFY" ? (
                      <>
                        <span>
                          Out Value:{" "}
                          <strong className="text-rose-600 dark:text-rose-400">
                            {currency} {formatAmount(totalOutValue)}
                          </strong>
                        </span>
                        <span>
                          In Value:{" "}
                          <strong className="text-emerald-600 dark:text-emerald-400">
                            {currency} {formatAmount(totalInValue)}
                          </strong>
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded-lg font-bold ${
                            reclassifyVariance <= 0.05
                              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400"
                          }`}
                        >
                          {reclassifyVariance <= 0.05
                            ? "✓ Balanced"
                            : `Variance: ${currency} ${formatAmount(reclassifyVariance)}`}
                        </span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-bold text-teal-700 dark:text-teal-300">
                        <Scale className="w-4 h-4" /> Balanced Debit / Credit:{" "}
                        {currency} {formatAmount(netAdjustmentValue)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                  Memo / Reference Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional explanation for audit trail..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-xs outline-none focus:border-teal-500"
                />
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
                  {saving ? "Posting..." : "Save & Post Balanced Entry"}
                </button>
              </div>
            </div>
          </div>
        )}
      </ERPShell>
    </>
  );
}