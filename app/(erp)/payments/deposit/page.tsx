"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Toaster, toast } from "react-hot-toast";
import ERPShell from "@/app/components/erp-shell";
import { supabase } from "@/app/lib/supabase";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import {
  ArrowLeft,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Landmark,
  Wallet,
  BookOpen,
  FileSpreadsheet,
  ShieldCheck,
  Eye,
  Lock,
  ArrowDownLeft,
  CheckCircle2,
  X,
} from "lucide-react";

type DepositTargetType = "CASH_BOOK" | "BANK_ACCOUNT" | "SELECTED_ACCOUNT";
type DepositInstrument = "CASH" | "ONLINE" | "CHEQUE";
type SourceCategoryFilter = "ALL" | "EQUITY" | "REVENUE" | "ASSET" | "LIABILITY";

export default function DirectDepositsPage() {
  const { settings, formatAmount, currency } = useERPConfig();
  const isCompact = settings?.appearance?.dataDensity === "compact";

  const [companyId, setCompanyId] = useState("001");
  const [deposits, setDeposits] = useState<any[]>([]);
  const [allAccounts, setAllAccounts] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"POSTED" | "UNPOSTED">("POSTED");

  // Role & Approval Box State
  const [canApprove, setCanApprove] = useState(true);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // Audit Trace Drawer State
  const [viewingAuditDeposit, setViewingAuditDeposit] = useState<any | null>(null);

  // New Deposit Modal State
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceCategoryFilter>("ALL");

  const [form, setForm] = useState({
    paymentDate: new Date().toISOString().split("T")[0],
    targetType: "BANK_ACCOUNT" as DepositTargetType,
    targetId: "", // Cash Book GL ID, BankDirectory ID, or Selected GL Account ID
    method: "ONLINE" as DepositInstrument,
    chequeNo: "",
    chequeDate: new Date().toISOString().split("T")[0],
    chequeBankName: "",
    sourceAccountId: "", // Credit GL Account (Where funds came from)
    depositorName: "",
    amount: "",
    reference: "",
    description: "",
  });

  // Quick Add Source GL Account Modal State
  const [showNewSourceModal, setShowNewSourceModal] = useState(false);
  const [newSourceForm, setNewSourceForm] = useState({
    type: "EQUITY" as "EQUITY" | "REVENUE" | "LIABILITY" | "ASSET",
    name: "",
    code: "",
  });
  const [savingSource, setSavingSource] = useState(false);

  const journalPrefix = settings?.numbering?.journalPrefix || "JE-";

  useEffect(() => {
    try {
      const savedRole = localStorage.getItem("erp_user_role");
      if (savedRole && savedRole !== "ADMIN" && savedRole !== "MANAGER") {
        setCanApprove(false);
      }
    } catch {}
    loadDepositData();
  }, []);

  async function loadDepositData() {
    try {
      setLoading(true);
      const { data: comp } = await supabase
        .from("Company")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (comp?.id) setCompanyId(comp.id);

      const [depRes, accRes, bankRes] = await Promise.all([
        supabase
          .from("PaymentVoucher")
          .select("*")
          .eq("mode", "deposit")
          .order("paymentDate", { ascending: false }),
        fetch("/api/accounts")
          .then((r) => r.json())
          .catch(() => ({ accounts: [] })),
        fetch("/api/banking/accounts")
          .then((r) => r.json())
          .catch(() => ({ accounts: [] })),
      ]);

      let loadedAccounts = accRes.accounts || [];
      if (loadedAccounts.length === 0) {
        const { data: fallbackAccs } = await supabase
          .from("Account")
          .select("*")
          .order("code");
        loadedAccounts = fallbackAccs || [];
      }

      setDeposits(depRes.data || []);
      setAllAccounts(loadedAccounts.filter((a: any) => a.isActive !== false));
      setBankAccounts(
        (bankRes.accounts || []).filter((b: any) => b.isActive !== false)
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to load Direct Deposits.");
    } finally {
      setLoading(false);
    }
  }

  // 1. Active Cash Books (Target Option 1)
  const activeCashBooks = useMemo(() => {
    return allAccounts.filter((a) => {
      if (a.type !== "ASSET") return false;
      const n = (a.name || "").toLowerCase();
      return (
        n.includes("cash") &&
        !n.includes("bank") &&
        !n.includes("meezan") &&
        !n.includes("easypaisa")
      );
    });
  }, [allAccounts]);

  // 2. Source Accounts Filtered by Category (Credit Side)
  const filteredSourceAccounts = useMemo(() => {
    if (sourceFilter === "ALL") return allAccounts;
    return allAccounts.filter((a) => a.type === sourceFilter);
  }, [allAccounts, sourceFilter]);

  function handleTargetTypeChange(newTargetType: DepositTargetType) {
    let defaultTargetId = "";
    let defaultMethod: DepositInstrument = form.method;

    if (newTargetType === "CASH_BOOK") {
      defaultTargetId = activeCashBooks[0]?.id || "";
      defaultMethod = "CASH";
    } else if (newTargetType === "BANK_ACCOUNT") {
      defaultTargetId = bankAccounts[0]?.id || "";
      defaultMethod = "ONLINE";
    } else {
      defaultTargetId = allAccounts[0]?.id || "";
    }

    setForm((prev) => ({
      ...prev,
      targetType: newTargetType,
      targetId: defaultTargetId,
      method: defaultMethod,
    }));
  }

  function openNewDepositModal(initialTarget: DepositTargetType = "BANK_ACCOUNT") {
    const defaultTargetId =
      initialTarget === "CASH_BOOK"
        ? activeCashBooks[0]?.id || ""
        : initialTarget === "BANK_ACCOUNT"
        ? bankAccounts[0]?.id || ""
        : allAccounts[0]?.id || "";

    const defaultSource =
      allAccounts.find((a) => a.type === "EQUITY")?.id ||
      allAccounts.find((a) => a.type === "REVENUE")?.id ||
      "";

    setForm({
      paymentDate: new Date().toISOString().split("T")[0],
      targetType: initialTarget,
      targetId: defaultTargetId,
      method: initialTarget === "CASH_BOOK" ? "CASH" : "ONLINE",
      chequeNo: "",
      chequeDate: new Date().toISOString().split("T")[0],
      chequeBankName: "",
      sourceAccountId: defaultSource,
      depositorName: "",
      amount: "",
      reference: "",
      description: "",
    });
    setSourceFilter("ALL");
    setShowDepositModal(true);
  }

  // Resolve Target (Debit) & Source (Credit) GL Accounts
  function resolveDepositAccounts() {
    let debitGlAccount: any = null;
    let debitDisplayLabel = "";
    let linkedBankRecord: any = null;

    if (form.targetType === "CASH_BOOK") {
      debitGlAccount = activeCashBooks.find((a) => a.id === form.targetId);
      debitDisplayLabel = debitGlAccount
        ? `Cash Book: ${debitGlAccount.code} - ${debitGlAccount.name}`
        : "Cash Book";
    } else if (form.targetType === "BANK_ACCOUNT") {
      linkedBankRecord = bankAccounts.find((b) => b.id === form.targetId);
      if (linkedBankRecord) {
        debitGlAccount =
          allAccounts.find(
            (a) =>
              a.id === linkedBankRecord.glAccountId ||
              a.name
                .toLowerCase()
                .includes(linkedBankRecord.bankName.toLowerCase())
          ) ||
          allAccounts.find(
            (a) => a.type === "ASSET" && a.name.toLowerCase().includes("bank")
          ) ||
          allAccounts.find((a) => a.type === "ASSET");

        debitDisplayLabel = `Bank: ${linkedBankRecord.bankName} — ${linkedBankRecord.accountTitle} (${linkedBankRecord.accountNumber})`;
      }
    } else {
      // SELECTED_ACCOUNT
      debitGlAccount = allAccounts.find((a) => a.id === form.targetId);
      debitDisplayLabel = debitGlAccount
        ? `Account: ${debitGlAccount.code} - ${debitGlAccount.name}`
        : "Selected Account";
    }

    const creditGlAccount = allAccounts.find(
      (a) => a.id === form.sourceAccountId
    );
    const creditDisplayLabel = creditGlAccount
      ? `${creditGlAccount.code} - ${creditGlAccount.name} (${creditGlAccount.type})`
      : "Source Account";

    return {
      debitGlId: debitGlAccount?.id || "",
      debitLabel: debitDisplayLabel,
      bankRecord: linkedBankRecord,
      creditGlId: creditGlAccount?.id || "",
      creditLabel: creditDisplayLabel,
    };
  }

  // Create New Source Account (Capital / Revenue / Liability / Asset) On the Fly
  async function handleCreateSourceAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!newSourceForm.name.trim()) {
      toast.error("Please enter an account name.");
      return;
    }

    setSavingSource(true);
    try {
      const prefixMap = {
        EQUITY: "31",
        REVENUE: "41",
        LIABILITY: "21",
        ASSET: "11",
      };
      const prefix = prefixMap[newSourceForm.type];
      const existing = allAccounts.filter((a) =>
        String(a.code || "").startsWith(prefix)
      );
      const autoCode =
        newSourceForm.code.trim() ||
        `${prefix}${String(existing.length + 1).padStart(2, "0")}`;

      const { data: created, error } = await supabase
        .from("Account")
        .insert([
          {
            companyId,
            code: autoCode,
            name: newSourceForm.name.trim(),
            type: newSourceForm.type,
            isActive: true,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setAllAccounts((prev) => [...prev, created]);
      setForm((prev) => ({ ...prev, sourceAccountId: created.id }));
      setShowNewSourceModal(false);
      setNewSourceForm({ type: "EQUITY", name: "", code: "" });
      toast.success(`Created source account "${created.name}" (${created.code})!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create account.");
    } finally {
      setSavingSource(false);
    }
  }

  async function handleSaveDeposit(targetStatus: "UNPOSTED" | "POSTED") {
    const amount = parseFloat(form.amount) || 0;
    const resolved = resolveDepositAccounts();

    if (!form.targetId || !resolved.debitGlId) {
      toast.error(
        "Please select a valid Deposit Destination (Cash Book, Bank, or Account)."
      );
      return;
    }
    if (!form.sourceAccountId || !resolved.creditGlId) {
      toast.error("Please select the Source Account (Credit) for this deposit.");
      return;
    }
    if (resolved.debitGlId === resolved.creditGlId && !resolved.bankRecord) {
      toast.error("Deposit Destination and Source Account cannot be the same.");
      return;
    }
    if (amount <= 0) {
      toast.error("Deposit amount must be greater than zero.");
      return;
    }
    if (form.method === "CHEQUE" && !form.chequeNo.trim()) {
      toast.error("Please enter the Cheque Number for this deposit.");
      return;
    }

    setSaving(true);
    try {
      const nextNum = deposits.length + 1;
      const voucherNo = `DP-${String(nextNum).padStart(4, "0")}`;

      const { data: createdVoucher, error: vErr } = await supabase
        .from("PaymentVoucher")
        .insert([
          {
            companyId,
            mode: "deposit",
            voucherNo,
            paymentDate: new Date(form.paymentDate).toISOString(),
            method: form.method,
            chequeNo: form.method === "CHEQUE" ? form.chequeNo.trim() : null,
            chequeDate:
              form.method === "CHEQUE" && form.chequeDate
                ? new Date(form.chequeDate).toISOString()
                : null,
            chequeBankName:
              form.method === "CHEQUE"
                ? form.chequeBankName.trim() || resolved.bankRecord?.bankName
                : null,
            chequeStatus: form.method === "CHEQUE" ? "PENDING" : "CLEARED",
            accountId: resolved.debitGlId,
            accountName: resolved.debitLabel,
            bankAccountId: resolved.bankRecord?.id || null,
            debitAccountId: resolved.debitGlId,
            debitAccountName: resolved.debitLabel,
            creditAccountId: resolved.creditGlId,
            creditAccountName: resolved.creditLabel,
            customerName: form.depositorName.trim() || null,
            expenseParentGroup: form.targetType, // Tracks CASH_BOOK, BANK_ACCOUNT, or SELECTED_ACCOUNT
            amount,
            reference:
              form.reference.trim() ||
              (form.method === "CHEQUE" ? `CHQ-${form.chequeNo}` : null),
            description:
              form.description.trim() ||
              `Direct Deposit into ${resolved.debitLabel}`,
            status: "UNPOSTED",
          },
        ])
        .select()
        .single();

      if (vErr) throw vErr;

      if (targetStatus === "POSTED") {
        await executeApproveAndPostDeposit(createdVoucher);
      } else {
        toast.success(
          `Deposit Voucher ${voucherNo} saved as Unposted Draft (Sent to Approval Box).`
        );
        setStatusTab("UNPOSTED");
      }

      setShowDepositModal(false);
      await loadDepositData();
    } catch (err: any) {
      toast.error(err.message || "Failed to record direct deposit.");
    } finally {
      setSaving(false);
    }
  }

  async function executeApproveAndPostDeposit(voucher: any) {
    const { count } = await supabase
      .from("JournalEntry")
      .select("*", { count: "exact", head: true });
    const journalNo = `${journalPrefix}${String((count || 0) + 1).padStart(4, "0")}`;

    const traceDescription = `Direct Deposit ${voucher.voucherNo} (${voucher.method}${
      voucher.chequeNo ? ` #${voucher.chequeNo}` : ""
    }) — Dr: ${voucher.debitAccountName} | Cr: ${voucher.creditAccountName}`;

    // 1. Create Main Journal Entry (JE-xxxx) with Sub-Voucher Reference (DP-xxxx)
    const { data: journal, error: jErr } = await supabase
      .from("JournalEntry")
      .insert([
        {
          companyId,
          entryNo: journalNo,
          entryNumber: journalNo,
          entryDate: voucher.paymentDate,
          reference: voucher.voucherNo,
          referenceType: "PAYMENT_DEPOSIT",
          referenceId: voucher.id,
          description: traceDescription,
          status: "POSTED",
        },
      ])
      .select()
      .single();

    if (jErr) throw jErr;

    await supabase.from("JournalLine").insert([
      {
        journalEntryId: journal.id,
        accountId: voucher.debitAccountId,
        debit: Number(voucher.amount),
        credit: 0,
        description: `[${voucher.voucherNo}] Deposit into ${voucher.debitAccountName}`,
      },
      {
        journalEntryId: journal.id,
        accountId: voucher.creditAccountId,
        debit: 0,
        credit: Number(voucher.amount),
        description: `[${voucher.voucherNo}] Source of funds: ${voucher.creditAccountName}`,
      },
    ]);

    // 2. If deposited into a Bank Directory account, record in BankTransaction subledger
    if (voucher.bankAccountId) {
      await supabase.from("BankTransaction").insert([
        {
          companyId,
          bankAccountId: voucher.bankAccountId,
          transactionDate: voucher.paymentDate,
          reference: `${voucher.voucherNo} / ${journalNo}${
            voucher.chequeNo ? ` (CHQ #${voucher.chequeNo})` : ""
          }`,
          description: traceDescription,
          instrumentType: voucher.method,
          moneyIn: Number(voucher.amount),
          moneyOut: 0,
          status: voucher.method === "CHEQUE" ? "PENDING" : "CLEARED",
          journalId: journal.id,
        },
      ]);
    }

    // 3. Mark Deposit Voucher as POSTED
    await supabase
      .from("PaymentVoucher")
      .update({
        status: "POSTED",
        journalNo,
        journalId: journal.id,
        approvedBy: "Admin",
        approvedAt: new Date().toISOString(),
      })
      .eq("id", voucher.id);

    toast.success(
      `Deposit Posted! Main Journal ${journalNo} -> Deposit Voucher ${voucher.voucherNo}`
    );
    setStatusTab("POSTED");
  }

  async function handleDeleteDeposit(v: any) {
    if (v.status === "POSTED") {
      toast.error("Posted deposits are locked to protect General Ledger balances.");
      return;
    }
    if (!confirm(`Delete unposted deposit voucher ${v.voucherNo}?`)) return;
    try {
      await supabase.from("PaymentVoucher").delete().eq("id", v.id);
      toast.success(`Deleted ${v.voucherNo}.`);
      await loadDepositData();
    } catch {
      toast.error("Failed to delete deposit voucher.");
    }
  }

  const unpostedDeposits = useMemo(
    () => deposits.filter((d) => d.status === "UNPOSTED"),
    [deposits]
  );

  const postedDeposits = useMemo(
    () => deposits.filter((d) => d.status === "POSTED"),
    [deposits]
  );

  const totalCashBookDeposits = postedDeposits
    .filter(
      (d) =>
        d.expenseParentGroup === "CASH_BOOK" ||
        (d.debitAccountName || "").toLowerCase().includes("cash book")
    )
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);

  const totalBankDeposits = postedDeposits
    .filter(
      (d) =>
        d.expenseParentGroup === "BANK_ACCOUNT" || Boolean(d.bankAccountId)
    )
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);

  const totalSelectedAccDeposits = postedDeposits
    .filter((d) => d.expenseParentGroup === "SELECTED_ACCOUNT")
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);

  const visibleDeposits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deposits.filter((d) => {
      if (d.status !== statusTab) return false;
      if (!q) return true;
      return [
        d.voucherNo,
        d.journalNo,
        d.chequeNo,
        d.debitAccountName,
        d.creditAccountName,
        d.customerName,
        d.reference,
        d.description,
      ]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(q));
    });
  }, [deposits, statusTab, search]);

  const cellPad = isCompact ? "py-2.5 px-4" : "py-3.5 px-5";

  return (
    <>
      <Toaster position="top-right" />
      <ERPShell title="Direct Fund Deposits">
        <div className="space-y-6 relative z-10">
          {/* Header Bar */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl border bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center shrink-0">
                <Landmark className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    href="/payments"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-teal-500 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Payments Hub
                  </Link>
                  <span className="text-slate-300 dark:text-zinc-700">•</span>
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400">
                    Dedicated DEPOSIT Module (DP-xxxx)
                  </span>
                </div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  Direct Fund Deposits (Cash Book, Bank &amp; GL Accounts)
                </h1>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Deposit funds directly into your active Cash Book, Bank Directory accounts, or any selected GL account with full JE/DP audit tracing.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setCanApprove((prev) => !prev)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-950 text-[11px] font-bold text-slate-600 dark:text-zinc-400 flex items-center gap-1.5"
              >
                <ShieldCheck
                  className={`w-3.5 h-3.5 ${
                    canApprove ? "text-teal-500" : "text-slate-400"
                  }`}
                />
                Role: {canApprove ? "Admin / Approver" : "Standard User"}
              </button>

              {canApprove && (
                <button
                  type="button"
                  onClick={() => setShowApprovalModal(true)}
                  className="px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Deposit Approval Box
                  <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px]">
                    {unpostedDeposits.length}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => openNewDepositModal("BANK_ACCOUNT")}
                className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all"
              >
                <Plus className="w-4 h-4" /> + New Direct Deposit (DP)
              </button>
            </div>
          </div>

          {/* 3 Quick-Launch Destination Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex flex-col justify-between gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                    1. Cash Book Deposits
                  </span>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {currency} {formatAmount(totalCashBookDeposits)}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => openNewDepositModal("CASH_BOOK")}
                className="w-full py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-xs font-bold transition-all"
              >
                + Deposit into Cash Book
              </button>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex flex-col justify-between gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                    2. Bank Directory Deposits
                  </span>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {currency} {formatAmount(totalBankDeposits)}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Landmark className="w-5 h-5" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => openNewDepositModal("BANK_ACCOUNT")}
                className="w-full py-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-600 hover:text-white text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 text-xs font-bold transition-all"
              >
                + Deposit into Bank Account
              </button>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex flex-col justify-between gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">
                    3. Selected GL Account Deposits
                  </span>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {currency} {formatAmount(totalSelectedAccDeposits)}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
                  <BookOpen className="w-5 h-5" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => openNewDepositModal("SELECTED_ACCOUNT")}
                className="w-full py-2 rounded-xl bg-teal-50 dark:bg-teal-500/10 hover:bg-teal-600 hover:text-white text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30 text-xs font-bold transition-all"
              >
                + Deposit into Selected Account
              </button>
            </div>
          </div>

          {/* Deposits Audit Ledger Table */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden">
            <div className="p-5 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {(["POSTED", "UNPOSTED"] as const).map((tab) => {
                  const count = deposits.filter((d) => d.status === tab).length;
                  const active = statusTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setStatusTab(tab)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                        active
                          ? "bg-teal-600 text-white shadow-sm"
                          : "bg-white dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-white/10"
                      }`}
                    >
                      <span>
                        {tab === "POSTED"
                          ? "Posted Deposit Ledger"
                          : "Unposted Drafts"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] ${
                          active
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-zinc-300"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2.5 flex-1 sm:flex-initial justify-end">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search JE #, DP #, cheque #, or account..."
                    className="w-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs outline-none focus:border-teal-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadDepositData}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 hover:bg-slate-100 text-slate-700 dark:text-zinc-300 text-xs font-bold"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      loading ? "animate-spin text-teal-500" : ""
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 bg-slate-50/50 dark:bg-zinc-950/50">
                    <th className={cellPad}>Journal &amp; Deposit No</th>
                    <th className={cellPad}>Date &amp; Mode</th>
                    <th className={cellPad}>Deposited Into (Debit — Dr)</th>
                    <th className={cellPad}>Source of Funds (Credit — Cr)</th>
                    <th className={cellPad}>Reference / Narration</th>
                    <th className={`${cellPad} text-right`}>Amount</th>
                    <th className={`${cellPad} text-right`}>Audit / Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-16 text-center text-slate-400 animate-pulse"
                      >
                        Loading direct deposits...
                      </td>
                    </tr>
                  ) : visibleDeposits.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center space-y-1">
                        <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                          No {statusTab.toLowerCase()} direct deposits found
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-500">
                          Click &ldquo;+ New Direct Deposit (DP)&rdquo; above to deposit funds into Cash Book, Bank, or any GL Account.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    visibleDeposits.map((d) => (
                      <tr
                        key={d.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className={cellPad}>
                          {d.journalNo ? (
                            <div className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
                              {d.journalNo}
                            </div>
                          ) : (
                            <div className="text-[10px] font-bold text-amber-500 uppercase">
                              Pending Journal
                            </div>
                          )}
                          <div className="font-mono text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                            ↳ {d.voucherNo}
                          </div>
                        </td>

                        <td className={cellPad}>
                          <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                            {new Date(d.paymentDate).toISOString().slice(0, 10)}
                          </div>
                          <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-300">
                            {d.method}
                          </span>
                        </td>

                        <td className={cellPad}>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">
                            DEBIT (Dr — Destination)
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {d.debitAccountName || "—"}
                          </span>
                        </td>

                        <td className={cellPad}>
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase block">
                            CREDIT (Cr — Source)
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {d.creditAccountName || "—"}
                          </span>
                          {d.customerName && (
                            <span className="block text-[11px] text-slate-500">
                              Depositor: {d.customerName}
                            </span>
                          )}
                        </td>

                        <td className={cellPad}>
                          {d.method === "CHEQUE" && (
                            <div className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400">
                              CHQ #{d.chequeNo} ({d.chequeBankName || "Bank"})
                            </div>
                          )}
                          <div className="text-xs text-slate-600 dark:text-zinc-300">
                            {d.description || d.reference || "Direct Deposit"}
                          </div>
                        </td>

                        <td
                          className={`${cellPad} text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap`}
                        >
                          + {currency} {formatAmount(d.amount)}
                        </td>

                        <td
                          className={`${cellPad} text-right whitespace-nowrap space-x-1.5`}
                        >
                          <button
                            type="button"
                            onClick={() => setViewingAuditDeposit(d)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 text-xs font-bold"
                          >
                            <Eye className="w-3.5 h-3.5" /> Trace
                          </button>
                          {d.status === "UNPOSTED" && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDeposit(d)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50/50 dark:bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 text-xs font-semibold"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ==================== MODAL 1: RECORD DIRECT DEPOSIT ==================== */}
        {showDepositModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                  <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">
                    Direct Deposit Window • Sub-Voucher Prefix: DP-xxxx
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Deposit Funds into Cash Book, Bank, or Selected Account
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* STEP 1: CHOOSE DEPOSIT DESTINATION TYPE (CASH BOOK vs BANK vs SELECTED ACCOUNT) */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">
                  1. Where Are You Depositing Funds Into? (Debit Destination) *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => handleTargetTypeChange("CASH_BOOK")}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                      form.targetType === "CASH_BOOK"
                        ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-500 text-emerald-900 dark:text-emerald-200 shadow-sm"
                        : "bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400"
                    }`}
                  >
                    <Wallet className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Cash Book</div>
                      <div className="text-[10px] opacity-75">
                        Deposit into Active Cash Book
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTargetTypeChange("BANK_ACCOUNT")}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                      form.targetType === "BANK_ACCOUNT"
                        ? "bg-indigo-50 dark:bg-indigo-500/15 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-sm"
                        : "bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400"
                    }`}
                  >
                    <Landmark className="w-5 h-5 text-indigo-500 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Bank Directory</div>
                      <div className="text-[10px] opacity-75">
                        Deposit into Registered Bank
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTargetTypeChange("SELECTED_ACCOUNT")}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                      form.targetType === "SELECTED_ACCOUNT"
                        ? "bg-teal-50 dark:bg-teal-500/15 border-teal-500 text-teal-900 dark:text-teal-200 shadow-sm"
                        : "bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400"
                    }`}
                  >
                    <BookOpen className="w-5 h-5 text-teal-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Selected GL Account</div>
                      <div className="text-[10px] opacity-75">
                        Any Chart of Accounts Head
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* STEP 2: SELECT SPECIFIC DESTINATION ACCOUNT + INSTRUMENT + DATE + AMOUNT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block mb-1.5">
                    {form.targetType === "CASH_BOOK"
                      ? "Select Active Cash Book (Debit) *"
                      : form.targetType === "BANK_ACCOUNT"
                      ? "Select Bank Directory Account (Debit) *"
                      : "Select Target GL Account (Debit) *"}
                  </label>

                  {form.targetType === "CASH_BOOK" ? (
                    <select
                      value={form.targetId}
                      onChange={(e) =>
                        setForm({ ...form, targetId: e.target.value })
                      }
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 font-semibold outline-none focus:border-teal-500"
                    >
                      <option value="">-- Select Cash Book --</option>
                      {activeCashBooks.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  ) : form.targetType === "BANK_ACCOUNT" ? (
                    <select
                      value={form.targetId}
                      onChange={(e) =>
                        setForm({ ...form, targetId: e.target.value })
                      }
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 font-semibold outline-none focus:border-teal-500"
                    >
                      <option value="">-- Select Bank Account --</option>
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bankName} — {b.accountTitle} ({b.accountNumber})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={form.targetId}
                      onChange={(e) =>
                        setForm({ ...form, targetId: e.target.value })
                      }
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 font-semibold outline-none focus:border-teal-500"
                    >
                      <option value="">-- Select Any GL Account --</option>
                      {allAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name} ({a.type})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Deposit Instrument / Mode *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["CASH", "ONLINE", "CHEQUE"] as DepositInstrument[]).map(
                      (inst) => (
                        <button
                          key={inst}
                          type="button"
                          onClick={() => setForm({ ...form, method: inst })}
                          className={`py-2.5 px-3 rounded-lg border text-xs font-bold transition-all ${
                            form.method === inst
                              ? "bg-teal-600 text-white border-teal-600"
                              : "bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400"
                          }`}
                        >
                          {inst}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Deposit Date *
                  </label>
                  <input
                    type="date"
                    value={form.paymentDate}
                    onChange={(e) =>
                      setForm({ ...form, paymentDate: e.target.value })
                    }
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase block mb-1.5">
                    Deposit Amount ({currency}) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 font-bold outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* CHEQUE INSTRUMENT DETAILS (When CHEQUE is selected) */}
              {form.method === "CHEQUE" && (
                <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase block mb-1">
                      Cheque Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 00981234"
                      value={form.chequeNo}
                      onChange={(e) =>
                        setForm({ ...form, chequeNo: e.target.value })
                      }
                      className="w-full bg-white dark:bg-zinc-950 border border-amber-300 dark:border-amber-500/30 rounded-lg p-2.5 font-mono font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase block mb-1">
                      Cheque Date *
                    </label>
                    <input
                      type="date"
                      value={form.chequeDate}
                      onChange={(e) =>
                        setForm({ ...form, chequeDate: e.target.value })
                      }
                      className="w-full bg-white dark:bg-zinc-950 border border-amber-300 dark:border-amber-500/30 rounded-lg p-2.5 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase block mb-1">
                      Drawer / Issuing Bank
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Meezan Bank / UBL"
                      value={form.chequeBankName}
                      onChange={(e) =>
                        setForm({ ...form, chequeBankName: e.target.value })
                      }
                      className="w-full bg-white dark:bg-zinc-950 border border-amber-300 dark:border-amber-500/30 rounded-lg p-2.5 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: SOURCE OF FUNDS (CREDIT ACCOUNT) + ON-THE-FLY ACCOUNT CREATOR */}
              <div className="p-4 rounded-xl bg-indigo-50/40 dark:bg-indigo-500/5 border border-indigo-200 dark:border-indigo-500/20 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-indigo-800 dark:text-indigo-300 uppercase">
                    2. Source of Funds (Credit Account — Where Money Came From) *
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNewSourceModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> + New Source Account
                  </button>
                </div>

                {/* Quick Filter Pills */}
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: "ALL", label: "All Accounts" },
                      { id: "EQUITY", label: "Owner Capital / Equity" },
                      { id: "REVENUE", label: "Other Income / Revenue" },
                      { id: "ASSET", label: "Cash / Asset Transfer" },
                      { id: "LIABILITY", label: "Loans / Liabilities" },
                    ] as { id: SourceCategoryFilter; label: string }[]
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSourceFilter(tab.id)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                        sourceFilter === tab.id
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <select
                  value={form.sourceAccountId}
                  onChange={(e) =>
                    setForm({ ...form, sourceAccountId: e.target.value })
                  }
                  className="w-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 font-semibold outline-none focus:border-teal-500"
                >
                  <option value="">-- Select Source GL Account (Credit) --</option>
                  {filteredSourceAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name} ({a.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Depositor, Reference & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Depositor / Person Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Owner / Partner Name"
                    value={form.depositorName}
                    onChange={(e) =>
                      setForm({ ...form, depositorName: e.target.value })
                    }
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Deposit Slip / Reference #
                  </label>
                  <input
                    type="text"
                    placeholder="Optional bank slip or ref #"
                    value={form.reference}
                    onChange={(e) =>
                      setForm({ ...form, reference: e.target.value })
                    }
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 font-mono outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Audit Narration / Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Capital injection for stock"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveDeposit("UNPOSTED")}
                  className="px-5 py-2.5 rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save to Approval Box (Unposted)"}
                </button>
                {canApprove && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveDeposit("POSTED")}
                    className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-teal-500/20 disabled:opacity-50"
                  >
                    {saving ? "Posting..." : "Approve & Post Deposit Now"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== MODAL 2: CREATE NEW SOURCE ACCOUNT ==================== */}
        {showNewSourceModal && (
          <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Create New Deposit Source Account
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Add a new Capital, Income, Liability, or Asset head to your Chart of Accounts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewSourceModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSourceAccount} className="space-y-4 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Account Classification *
                  </label>
                  <select
                    value={newSourceForm.type}
                    onChange={(e) =>
                      setNewSourceForm({
                        ...newSourceForm,
                        type: e.target.value as any,
                      })
                    }
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 font-bold outline-none focus:border-teal-500"
                  >
                    <option value="EQUITY">Equity / Owner Capital (31xx)</option>
                    <option value="REVENUE">Other Income / Revenue (41xx)</option>
                    <option value="LIABILITY">Loan / Liability (21xx)</option>
                    <option value="ASSET">Asset Account (11xx)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Account Name *
                  </label>
                  <input
                    required
                    autoFocus
                    placeholder="e.g. Owner Capital - Shama Zafar"
                    value={newSourceForm.name}
                    onChange={(e) =>
                      setNewSourceForm({ ...newSourceForm, name: e.target.value })
                    }
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Account Code (Optional — Auto-assigned if blank)
                  </label>
                  <input
                    placeholder="Leave blank to auto-generate"
                    value={newSourceForm.code}
                    onChange={(e) =>
                      setNewSourceForm({ ...newSourceForm, code: e.target.value })
                    }
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 font-mono outline-none focus:border-teal-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowNewSourceModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSource}
                    className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2 rounded-xl text-xs font-bold"
                  >
                    {savingSource ? "Creating..." : "Create & Select"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================== MODAL 3: ROLE-GATED DEPOSIT APPROVAL BOX ==================== */}
        {showApprovalModal && canApprove && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl max-h-[88vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-amber-500" />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Direct Deposit Approval Box
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Approving a deposit generates a Main Journal No (JE-xxxx) and posts the funds to the destination account.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowApprovalModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 text-[10px] font-bold uppercase text-slate-500">
                    <th className="py-2.5 px-3">Deposit No</th>
                    <th className="py-2.5 px-3">Date / Mode</th>
                    <th className="py-2.5 px-3">Destination (Dr) &larr; Source (Cr)</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                  {unpostedDeposits.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        No unposted deposits waiting for approval.
                      </td>
                    </tr>
                  ) : (
                    unpostedDeposits.map((d) => (
                      <tr key={d.id}>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          {d.voucherNo}
                        </td>
                        <td className="py-3 px-3">
                          {new Date(d.paymentDate).toISOString().slice(0, 10)} ({d.method})
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-emerald-600 font-semibold">
                            Dr: {d.debitAccountName}
                          </div>
                          <div className="text-indigo-500 font-semibold">
                            Cr: {d.creditAccountName}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {currency} {formatAmount(d.amount)}
                        </td>
                        <td className="py-3 px-3 text-right space-x-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await executeApproveAndPostDeposit(d);
                              await loadDepositData();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                          >
                            Approve &amp; Post
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDeposit(d)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 font-bold"
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== MODAL 4: AUDIT TRACE DRAWER ==================== */}
        {viewingAuditDeposit && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                  <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">
                    Double-Entry Deposit Audit Trail
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Deposit Voucher Trace: {viewingAuditDeposit.voucherNo}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingAuditDeposit(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 space-y-3 text-xs font-mono">
                <div className="flex justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                  <span className="text-slate-500">Main Journal No:</span>
                  <strong className="text-teal-600 dark:text-teal-400">
                    {viewingAuditDeposit.journalNo || "UNPOSTED"}
                  </strong>
                </div>
                <div className="flex justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                  <span className="text-slate-500">Sub-Voucher (Deposit No):</span>
                  <strong className="text-slate-900 dark:text-white">
                    {viewingAuditDeposit.voucherNo}
                  </strong>
                </div>
                <div className="flex justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                  <span className="text-slate-500">Instrument / Mode:</span>
                  <strong className="text-slate-900 dark:text-white">
                    {viewingAuditDeposit.method}
                    {viewingAuditDeposit.chequeNo
                      ? ` (Cheque #${viewingAuditDeposit.chequeNo})`
                      : ""}
                  </strong>
                </div>

                <div className="pt-2 space-y-2">
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block">
                        DEBIT (Dr — Where Funds Were Deposited)
                      </span>
                      <strong className="text-slate-900 dark:text-white">
                        {viewingAuditDeposit.debitAccountName}
                      </strong>
                    </div>
                    <strong className="text-emerald-700 dark:text-emerald-400">
                      {currency} {formatAmount(viewingAuditDeposit.amount)}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 block">
                        CREDIT (Cr — Where Funds Came From)
                      </span>
                      <strong className="text-slate-900 dark:text-white">
                        {viewingAuditDeposit.creditAccountName}
                      </strong>
                    </div>
                    <strong className="text-indigo-700 dark:text-indigo-400">
                      {currency} {formatAmount(viewingAuditDeposit.amount)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </ERPShell>
    </>
  );
}