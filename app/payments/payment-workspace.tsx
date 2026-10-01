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
  ArrowDownLeft,
  ArrowUpRight,
  Flame,
  Landmark,
  Wallet,
  FileSpreadsheet,
  ShieldCheck,
  Eye,
  Lock,
  Edit3,
  Send,
  CheckCircle2,
  X,
} from "lucide-react";

export type Mode = "receive" | "supplier" | "expense" | "deposit";
type PaymentMethod = "CASH" | "ONLINE" | "CHEQUE";
type ExpenseParentGroup = "Cost of Sales" | "Operating Expense" | "Finance Expense";
// 3-Stage Lifecycle: DRAFT (User working) -> UNAPPROVED (User Posted, awaiting Admin) -> POSTED (Admin Approved & on GL)
type VoucherStatus = "DRAFT" | "UNAPPROVED" | "POSTED";

const MODE_CONFIG: Record<
  Mode,
  {
    title: string;
    subtitle: string;
    buttonLabel: string;
    voucherPrefix: string;
    icon: any;
    accentBadge: string;
  }
> = {
  receive: {
    title: "Sales Payment Receipts",
    subtitle: "Receive customer payments via Cash, Online Bank, or Multi-Invoice Cheques.",
    buttonLabel: "New Customer Receipt (RE)",
    voucherPrefix: "RE-",
    icon: ArrowDownLeft,
    accentBadge:
      "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30",
  },
  supplier: {
    title: "Supplier Bill Payments",
    subtitle:
      "Select Cash or Online mode (accounts resolved automatically from Settings) and allocate against supplier bills.",
    buttonLabel: "New Supplier Payment (PV)",
    voucherPrefix: "PV-",
    icon: ArrowUpRight,
    accentBadge:
      "bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/30",
  },
  expense: {
    title: "Expense Vouchers & Heads",
    subtitle:
      "Select Cash or Online mode (accounts from Settings), and select or create Expense Heads under Cost of Sales, Operating, or Finance.",
    buttonLabel: "New Expense Voucher (EV)",
    voucherPrefix: "EV-",
    icon: Flame,
    accentBadge:
      "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
  },
  deposit: {
    title: "Direct Fund Deposits",
    subtitle:
      "Directly deposit capital, owner injections, or external funds into Cash Book or Bank Directory.",
    buttonLabel: "New Direct Deposit (DP)",
    voucherPrefix: "DP-",
    icon: Landmark,
    accentBadge:
      "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30",
  },
};

const EXPENSE_PARENT_META: Record<ExpenseParentGroup, { codePrefix: string; desc: string }> = {
  "Cost of Sales": {
    codePrefix: "51",
    desc: "Direct production, packaging, freight-in, and direct material costs.",
  },
  "Operating Expense": {
    codePrefix: "52",
    desc: "Salaries, rent, utilities, marketing, courier delivery, and admin expenses.",
  },
  "Finance Expense": {
    codePrefix: "53",
    desc: "Bank charges, transaction fees, loan markup, and financial costs.",
  },
};

export default function PaymentWorkspace({ mode }: { mode: Mode }) {
  const { settings, formatAmount, currency } = useERPConfig();
  const isCompact = settings?.appearance?.dataDensity === "compact";
  const meta = MODE_CONFIG[mode] || MODE_CONFIG.receive;
  const ModeIcon = meta.icon;

  // Supplier & Expense use strict Settings-driven Cash/Online mode
  const isStrictSettingsMode = mode === "supplier" || mode === "expense";

  const [companyId, setCompanyId] = useState("001");
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [allocationsByVoucher, setAllocationsByVoucher] = useState<Record<string, any[]>>({});

  // Master Data
  const [allAccounts, setAllAccounts] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  // UI & Filter State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"POSTED" | "UNAPPROVED" | "DRAFT">("POSTED");

  // Role Permission State (Checked from /api/auth/me or Roles; only Admins/Approvers can see Approval Box)
  const [canApprove, setCanApprove] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // Audit Trace Modal State
  const [viewingAuditVoucher, setViewingAuditVoucher] = useState<any | null>(null);

  // Create / Edit Voucher Modal State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<any | null>(null);
  const [form, setForm] = useState({
    paymentDate: new Date().toISOString().split("T")[0],
    method: "CASH" as PaymentMethod,
    accountId: "",
    chequeNo: "",
    chequeDate: new Date().toISOString().split("T")[0],
    chequeBankName: "",
    supplierId: "",
    customerId: "",
    expenseParentGroup: "Operating Expense" as ExpenseParentGroup,
    expenseAccountId: "",
    depositSourceAccountId: "",
    amount: "",
    reference: "",
    description: "",
  });

  const [selectedDocs, setSelectedDocs] = useState<Record<string, number>>({});

  // New Expense Head Modal State
  const [showHeadModal, setShowHeadModal] = useState(false);
  const [headForm, setHeadForm] = useState({
    parentGroup: "Operating Expense" as ExpenseParentGroup,
    name: "",
    code: "",
  });
  const [headSaving, setHeadSaving] = useState(false);

  const journalPrefix = settings?.numbering?.journalPrefix || "JE-";
  const defaultArAccountId = settings?.accounting?.arAccountId || "";
  const defaultApAccountId = settings?.accounting?.apAccountId || "";
  const configuredCashAccountId = (settings?.accounting as any)?.defaultCashAccountId || "";
  const configuredOnlineBankId =
    (settings?.accounting as any)?.defaultOnlineBankAccountId ||
    settings?.accounting?.loanDepositAccountId ||
    settings?.sales?.courierDepositAccount ||
    "";

  // Check if current logged-in user is Admin or has Approval permission
  useEffect(() => {
    async function checkApprovalPermission() {
      try {
        const res = await fetch("/api/auth/me").catch(() => null);
        if (res && res.ok) {
          const data = await res.json();
          const roleName = String(data?.user?.role?.name || data?.role || "").toUpperCase();
          const perms: string[] = data?.user?.role?.permissions || data?.permissions || [];
          const hasAdminAccess =
            roleName.includes("ADMIN") ||
            roleName.includes("MANAGER") ||
            perms.includes("/") ||
            perms.includes("/payments/approve") ||
            perms.includes("/admin");
          setCanApprove(hasAdminAccess);
          return;
        }
      } catch {}

      // Fallback to localStorage role check if /api/auth/me is not present
      const savedRole = (localStorage.getItem("erp_user_role") || "ADMIN").toUpperCase();
      setCanApprove(savedRole === "ADMIN" || savedRole === "MANAGER");
    }

    checkApprovalPermission();
    loadWorkspaceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  supabase
          .from("SalesInvoice")
          .select("id, invoiceNo, customerId, total, paid, balance, invoiceDate, status")
          .gt("balance", 0)
          .order("invoiceDate", { ascending: false }),

  async function loadWorkspaceData() {
    try {
      setLoading(true);
      const { data: comp } = await supabase.from("Company").select("id").limit(1).maybeSingle();
      if (comp?.id) setCompanyId(comp.id);

      const [
        vRes,
        allocRes,
        accRes,
        bankApiRes,
        supRes,
        custRes,
        billRes,
        invRes,
      ] = await Promise.all([
        supabase
          .from("PaymentVoucher")
          .select("*")
          .eq("mode", mode)
          .order("paymentDate", { ascending: false }),
        supabase.from("PaymentVoucherAllocation").select("*"),
        fetch("/api/accounts").then((r) => r.json()).catch(() => ({ accounts: [] })),
        fetch("/api/banking/accounts").then((r) => r.json()).catch(() => ({ accounts: [] })),
        supabase.from("Supplier").select("id, name").order("name"),
        supabase.from("Customer").select("id, name").order("name"),
        supabase
          .from("PurchaseBill")
          .select("id, billNo, supplierId, total, paid, balance, billDate, status")
          .gt("balance", 0)
          .order("billDate", { ascending: false }),
        supabase
          .from("SalesInvoice")
          .select("id, invoiceNo, customerId, total, paid, balance, issueDate, status")
          .gt("balance", 0)
          .order("issueDate", { ascending: false }),
      ]);

      let loadedAccounts = accRes.accounts || [];
      if (loadedAccounts.length === 0) {
        const { data: fallbackAccs } = await supabase.from("Account").select("*").order("code");
        loadedAccounts = fallbackAccs || [];
      }

      const allocMap: Record<string, any[]> = {};
      (allocRes.data || []).forEach((a: any) => {
        if (!allocMap[a.voucherId]) allocMap[a.voucherId] = [];
        allocMap[a.voucherId].push(a);
      });

      setVouchers(vRes.data || []);
      setAllocationsByVoucher(allocMap);
      setAllAccounts(loadedAccounts);
      setBankAccounts((bankApiRes.accounts || []).filter((b: any) => b.isActive !== false));
      setSuppliers(supRes.data || []);
      setCustomers(custRes.data || []);
      setBills(billRes.data || []);
      setInvoices(invRes.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load payment workspace.");
    } finally {
      setLoading(false);
    }
  }

  const activeCashAccounts = useMemo(() => {
    return allAccounts.filter((a) => {
      if (a.type !== "ASSET" || a.isActive === false) return false;
      const n = (a.name || "").toLowerCase();
      return (
        n.includes("cash") &&
        !n.includes("bank") &&
        !n.includes("meezan") &&
        !n.includes("easypaisa")
      );
    });
  }, [allAccounts]);

  const autoResolvedSettingsAccount = useMemo(() => {
    const cashAcc =
      allAccounts.find((a) => a.id === configuredCashAccountId) ||
      activeCashAccounts[0] ||
      allAccounts.find((a) => a.type === "ASSET" && a.name.toLowerCase().includes("cash")) ||
      allAccounts.find((a) => a.type === "ASSET");

    let onlineGlAcc = allAccounts.find((a) => a.id === configuredOnlineBankId);
    const firstBankDir = bankAccounts[0];
    if (!onlineGlAcc && firstBankDir) {
      onlineGlAcc = allAccounts.find(
        (a) =>
          a.id === firstBankDir.glAccountId ||
          a.name.toLowerCase().includes(firstBankDir.bankName.toLowerCase())
      );
    }
    if (!onlineGlAcc) {
      onlineGlAcc =
        allAccounts.find(
          (a) =>
            a.type === "ASSET" &&
            (a.name.toLowerCase().includes("bank") || a.name.toLowerCase().includes("meezan"))
        ) || cashAcc;
    }

    const matchedBankDir =
      bankAccounts.find(
        (b) =>
          b.glAccountId === onlineGlAcc?.id ||
          (onlineGlAcc?.name &&
            onlineGlAcc.name.toLowerCase().includes(b.bankName.toLowerCase()))
      ) || firstBankDir;

    return {
      cash: cashAcc || null,
      onlineGl: onlineGlAcc || null,
      onlineBankDir: matchedBankDir || null,
    };
  }, [allAccounts, activeCashAccounts, bankAccounts, configuredCashAccountId, configuredOnlineBankId]);

  const expenseAccountsByParent = useMemo(() => {
    const allExp = allAccounts.filter((a) => a.type === "EXPENSE" && a.isActive !== false);
    return allExp.filter((a) => {
      if (a.parentGroup === form.expenseParentGroup) return true;
      const code = String(a.code || "");
      const name = (a.name || "").toLowerCase();
      if (form.expenseParentGroup === "Cost of Sales") {
        return code.startsWith("51") || name.includes("cost") || name.includes("cogs");
      }
      if (form.expenseParentGroup === "Finance Expense") {
        return (
          code.startsWith("53") ||
          name.includes("bank charge") ||
          name.includes("finance") ||
          name.includes("interest")
        );
      }
      return !code.startsWith("51") && !code.startsWith("53");
    });
  }, [allAccounts, form.expenseParentGroup]);

  const partyDocuments = useMemo(() => {
    if (mode === "receive") {
      return form.customerId
        ? invoices.filter((i) => i.customerId === form.customerId)
        : invoices;
    }
    if (mode === "supplier") {
      return form.supplierId
        ? bills.filter((b) => b.supplierId === form.supplierId)
        : bills;
    }
    return [];
  }, [mode, form.customerId, form.supplierId, invoices, bills]);

  function handleMethodChange(newMethod: PaymentMethod) {
    let defaultId = "";
    if (newMethod === "CASH") {
      defaultId = autoResolvedSettingsAccount.cash?.id || activeCashAccounts[0]?.id || "";
    } else {
      defaultId = bankAccounts[0]?.id || autoResolvedSettingsAccount.onlineGl?.id || "";
    }
    setForm((prev) => ({
      ...prev,
      method: newMethod,
      accountId: defaultId,
    }));
  }

  function openCreateModal() {
    setEditingVoucher(null);
    const initialCashId =
      autoResolvedSettingsAccount.cash?.id || activeCashAccounts[0]?.id || "";
    setForm({
      paymentDate: new Date().toISOString().split("T")[0],
      method: "CASH",
      accountId: initialCashId,
      chequeNo: "",
      chequeDate: new Date().toISOString().split("T")[0],
      chequeBankName: "",
      supplierId: "",
      customerId: "",
      expenseParentGroup: "Operating Expense",
      expenseAccountId: "",
      depositSourceAccountId: "",
      amount: "",
      reference: "",
      description: "",
    });
    setSelectedDocs({});
    setShowFormModal(true);
  }

  function openEditVoucherModal(v: any) {
    if (v.status === "POSTED") {
      toast.error("Approved & Posted vouchers are locked on the General Ledger.");
      return;
    }
    setEditingVoucher(v);
    setForm({
      paymentDate: new Date(v.paymentDate).toISOString().split("T")[0],
      method: (v.method as PaymentMethod) || "CASH",
      accountId: v.bankAccountId || v.accountId || "",
      chequeNo: v.chequeNo || "",
      chequeDate: v.chequeDate
        ? new Date(v.chequeDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      chequeBankName: v.chequeBankName || "",
      supplierId: v.supplierId || "",
      customerId: v.customerId || "",
      expenseParentGroup: (v.expenseParentGroup as ExpenseParentGroup) || "Operating Expense",
      expenseAccountId: v.debitAccountId || "",
      depositSourceAccountId: v.creditAccountId || "",
      amount: String(v.amount || ""),
      reference: v.reference || "",
      description: v.description || "",
    });

    const existingAllocs: Record<string, number> = {};
    (allocationsByVoucher[v.id] || []).forEach((a: any) => {
      existingAllocs[a.docId] = Number(a.allocatedAmount || 0);
    });
    setSelectedDocs(existingAllocs);
    setShowFormModal(true);
  }

  function toggleDocumentSelection(doc: any) {
    setSelectedDocs((prev) => {
      const next = { ...prev };
      if (next[doc.id] !== undefined) {
        delete next[doc.id];
      } else {
        next[doc.id] = Number(doc.balance || 0);
      }
      const sum = Object.values(next).reduce((s, v) => s + Number(v || 0), 0);
      setForm((f) => ({
        ...f,
        amount: sum > 0 ? String(sum.toFixed(2)) : f.amount,
        customerId: mode === "receive" && doc.customerId ? doc.customerId : f.customerId,
        supplierId: mode === "supplier" && doc.supplierId ? doc.supplierId : f.supplierId,
      }));
      return next;
    });
  }

  function updateDocAllocationAmount(docId: string, val: string) {
    const num = Math.max(0, parseFloat(val) || 0);
    setSelectedDocs((prev) => {
      const next = { ...prev, [docId]: num };
      const sum = Object.values(next).reduce((s, v) => s + Number(v || 0), 0);
      setForm((f) => ({ ...f, amount: String(sum.toFixed(2)) }));
      return next;
    });
  }

  async function handleCreateExpenseHead(e: React.FormEvent) {
    e.preventDefault();
    if (!headForm.name.trim()) {
      toast.error("Please enter an Expense Head name.");
      return;
    }

    setHeadSaving(true);
    try {
      const prefix = EXPENSE_PARENT_META[headForm.parentGroup].codePrefix;
      const existingInGroup = allAccounts.filter((a) =>
        String(a.code || "").startsWith(prefix)
      );
      const autoCode =
        headForm.code.trim() ||
        `${prefix}${String(existingInGroup.length + 1).padStart(2, "0")}`;

      let createdAccount: any = null;

      const { data: sbCreated, error: sbError } = await supabase
        .from("Account")
        .insert([
          {
            companyId,
            code: autoCode,
            name: headForm.name.trim(),
            type: "EXPENSE",
            parentGroup: headForm.parentGroup,
            isActive: true,
          },
        ])
        .select()
        .maybeSingle();

      if (!sbError && sbCreated) {
        createdAccount = sbCreated;
      } else {
        const res = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "CREATE_EXPENSE_HEAD",
            name: headForm.name.trim(),
            code: autoCode,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || sbError?.message || "Failed to create Expense Head.");
        }
        createdAccount = { ...json.account, parentGroup: headForm.parentGroup };
      }

      setAllAccounts((prev) => [...prev, createdAccount]);
      setForm((prev) => ({
        ...prev,
        expenseParentGroup: headForm.parentGroup,
        expenseAccountId: createdAccount.id,
      }));
      setShowHeadModal(false);
      setHeadForm({ parentGroup: form.expenseParentGroup, name: "", code: "" });
      toast.success(
        `Expense Head "${createdAccount.name}" (${createdAccount.code}) created under ${headForm.parentGroup}!`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to create Expense Head.");
    } finally {
      setHeadSaving(false);
    }
  }

  function resolveDoubleEntryAccounts() {
    let liquidGlAccount: any = null;
    let selectedBankRecord: any = null;

    if (isStrictSettingsMode) {
      if (form.method === "CASH") {
        liquidGlAccount = autoResolvedSettingsAccount.cash;
      } else {
        liquidGlAccount = autoResolvedSettingsAccount.onlineGl;
        selectedBankRecord = autoResolvedSettingsAccount.onlineBankDir;
      }
    } else {
      if (form.method === "CASH") {
        liquidGlAccount =
          activeCashAccounts.find((a) => a.id === form.accountId) ||
          autoResolvedSettingsAccount.cash;
      } else {
        selectedBankRecord = bankAccounts.find((b) => b.id === form.accountId);
        if (selectedBankRecord) {
          liquidGlAccount =
            allAccounts.find(
              (a) =>
                a.id === selectedBankRecord.glAccountId ||
                a.name.toLowerCase().includes(selectedBankRecord.bankName.toLowerCase())
            ) || autoResolvedSettingsAccount.onlineGl;
        } else {
          liquidGlAccount = autoResolvedSettingsAccount.onlineGl;
        }
      }
    }

    const liquidLabel = selectedBankRecord
      ? `${selectedBankRecord.bankName} (${selectedBankRecord.accountNumber})`
      : liquidGlAccount
      ? `${liquidGlAccount.code} - ${liquidGlAccount.name}`
      : form.method === "CASH"
      ? "Cash Book (Settings)"
      : "Online Bank (Settings)";

    if (mode === "receive") {
      const arAcc =
        allAccounts.find((a) => a.id === defaultArAccountId) ||
        allAccounts.find(
          (a) => a.type === "ASSET" && a.name.toLowerCase().includes("receivable")
        ) ||
        allAccounts.find((a) => a.type === "ASSET");

      return {
        liquidGlId: liquidGlAccount?.id || arAcc?.id || "",
        liquidLabel,
        bankRecord: selectedBankRecord,
        debitId: liquidGlAccount?.id || "",
        debitName: liquidLabel,
        creditId: arAcc?.id || "",
        creditName: arAcc ? `${arAcc.code} - ${arAcc.name}` : "Accounts Receivable (Customer)",
      };
    }

    if (mode === "supplier") {
      const apAcc =
        allAccounts.find((a) => a.id === defaultApAccountId) ||
        allAccounts.find(
          (a) => a.type === "LIABILITY" && a.name.toLowerCase().includes("payable")
        ) ||
        allAccounts.find((a) => a.type === "LIABILITY");

      return {
        liquidGlId: liquidGlAccount?.id || apAcc?.id || "",
        liquidLabel,
        bankRecord: selectedBankRecord,
        debitId: apAcc?.id || "",
        debitName: apAcc ? `${apAcc.code} - ${apAcc.name}` : "Accounts Payable (Supplier)",
        creditId: liquidGlAccount?.id || "",
        creditName: liquidLabel,
      };
    }

    if (mode === "expense") {
      const expAcc = allAccounts.find((a) => a.id === form.expenseAccountId);
      return {
        liquidGlId: liquidGlAccount?.id || "",
        liquidLabel,
        bankRecord: selectedBankRecord,
        debitId: expAcc?.id || "",
        debitName: expAcc
          ? `${expAcc.code} - ${expAcc.name} (${form.expenseParentGroup})`
          : "Expense Head",
        creditId: liquidGlAccount?.id || "",
        creditName: liquidLabel,
      };
    }

    const srcAcc = allAccounts.find((a) => a.id === form.depositSourceAccountId);
    return {
      liquidGlId: liquidGlAccount?.id || "",
      liquidLabel,
      bankRecord: selectedBankRecord,
      debitId: liquidGlAccount?.id || "",
      debitName: liquidLabel,
      creditId: srcAcc?.id || "",
      creditName: srcAcc ? `${srcAcc.code} - ${srcAcc.name}` : "Deposit Source Account",
    };
  }

  // USERS CAN ONLY SAVE DRAFT ("DRAFT") OR POST FOR APPROVAL ("UNAPPROVED") — NEVER DIRECTLY APPROVE
  async function handleUserSaveOrPost(userAction: "DRAFT" | "UNAPPROVED") {
    const amount = parseFloat(form.amount) || 0;
    const resolved = resolveDoubleEntryAccounts();

    if (!isStrictSettingsMode && !form.accountId) {
      toast.error(
        form.method === "CASH"
          ? "Please select an Active Cash Book."
          : "Please select a Bank Account from the Bank Directory."
      );
      return;
    }
    if (isStrictSettingsMode && !resolved.liquidGlId) {
      toast.error("Please configure Default Cash / Bank accounts in Settings -> Accounting.");
      return;
    }
    if (amount <= 0) {
      toast.error("Please enter an amount greater than zero.");
      return;
    }
    if (!isStrictSettingsMode && form.method === "CHEQUE" && !form.chequeNo.trim()) {
      toast.error("Please enter a Cheque Number.");
      return;
    }
    if (mode === "expense" && !form.expenseAccountId) {
      toast.error("Please select or create an Expense Head.");
      return;
    }
    if (mode === "deposit" && !form.depositSourceAccountId) {
      toast.error("Please select the Credit / Source of Funds account.");
      return;
    }
    if ((mode === "receive" || mode === "supplier") && Object.keys(selectedDocs).length === 0) {
      toast.error(
        mode === "receive"
          ? "Please select at least one Customer Invoice to apply this receipt against."
          : "Please select at least one Supplier Bill to allocate this payment against."
      );
      return;
    }

    setSaving(true);
    try {
      const nextNum = vouchers.length + 1;
      const voucherNo =
        editingVoucher?.voucherNo ||
        `${meta.voucherPrefix}${String(nextNum).padStart(4, "0")}`;

      const supName = suppliers.find((s) => s.id === form.supplierId)?.name || null;
      const custName = customers.find((c) => c.id === form.customerId)?.name || null;

      let voucherId = editingVoucher?.id;

      const payload = {
        companyId,
        mode,
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
        accountId: resolved.liquidGlId,
        accountName: resolved.liquidLabel,
        bankAccountId: resolved.bankRecord?.id || null,
        debitAccountId: resolved.debitId,
        debitAccountName: resolved.debitName,
        creditAccountId: resolved.creditId,
        creditAccountName: resolved.creditName,
        supplierId: form.supplierId || null,
        supplierName: supName,
        customerId: form.customerId || null,
        customerName: custName,
        expenseParentGroup: mode === "expense" ? form.expenseParentGroup : null,
        amount,
        reference:
          form.reference.trim() ||
          (form.method === "CHEQUE" ? `CHQ-${form.chequeNo}` : null),
        description: form.description.trim() || null,
        status: userAction, // Strictly "DRAFT" or "UNAPPROVED"
      };

      if (editingVoucher) {
        const { error: uErr } = await supabase
          .from("PaymentVoucher")
          .update(payload)
          .eq("id", voucherId);
        if (uErr) throw uErr;
        await supabase
          .from("PaymentVoucherAllocation")
          .delete()
          .eq("voucherId", voucherId);
      } else {
        const { data: createdVoucher, error: vErr } = await supabase
          .from("PaymentVoucher")
          .insert([payload])
          .select()
          .single();
        if (vErr) throw vErr;
        voucherId = createdVoucher.id;
      }

      const allocationRows = Object.entries(selectedDocs)
        .filter(([, val]) => Number(val) > 0)
        .map(([docId, allocatedAmount]) => {
          const docObj =
            mode === "receive"
              ? invoices.find((i) => i.id === docId)
              : bills.find((b) => b.id === docId);
          return {
            voucherId,
            docType: mode === "receive" ? "INVOICE" : "BILL",
            docId,
            docNo: docObj?.invoiceNo || docObj?.billNo || "DOC",
            allocatedAmount: Number(allocatedAmount),
          };
        });

      if (allocationRows.length > 0) {
        await supabase.from("PaymentVoucherAllocation").insert(allocationRows);
      }

      if (userAction === "UNAPPROVED") {
        toast.success(
          `Voucher ${voucherNo} Posted! Sent to the Admin Approval Box for final GL approval.`
        );
        setStatusTab("UNAPPROVED");
      } else {
        toast.success(`Voucher ${voucherNo} saved as Draft.`);
        setStatusTab("DRAFT");
      }

      setShowFormModal(false);
      await loadWorkspaceData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save payment voucher.");
    } finally {
      setSaving(false);
    }
  }

  // User action on table row: Submit a Draft voucher to Posted (Awaiting Admin Approval)
  async function handleUserPostDraftRow(v: any) {
    try {
      setSaving(true);
      const { error } = await supabase
        .from("PaymentVoucher")
        .update({ status: "UNAPPROVED" })
        .eq("id", v.id);
      if (error) throw error;
      toast.success(`${v.voucherNo} posted and sent to Admin Approval Box!`);
      setStatusTab("UNAPPROVED");
      await loadWorkspaceData();
    } catch (err: any) {
      toast.error(err.message || "Failed to post voucher.");
    } finally {
      setSaving(false);
    }
  }

  // ADMIN-ONLY ACTION (Inside Approval Box): Approves Voucher -> Creates JE-xxxx -> Updates GL & Invoices
  async function executeAdminApprove(voucher: any) {
    if (!canApprove) {
      toast.error("Unauthorized: Only Admins or Approvers can approve vouchers.");
      return;
    }

    const allocations = allocationsByVoucher[voucher.id] || [];

    const { count } = await supabase
      .from("JournalEntry")
      .select("*", { count: "exact", head: true });
    const journalNo = `${journalPrefix}${String((count || 0) + 1).padStart(4, "0")}`;

    const allocDocNumbers = allocations.map((a: any) => a.docNo).join(", ");
    const traceDescription = `${voucher.voucherNo} (${voucher.method}${
      voucher.chequeNo ? ` #${voucher.chequeNo}` : ""
    }) — Dr: ${voucher.debitAccountName} | Cr: ${voucher.creditAccountName}${
      allocDocNumbers ? ` [Against: ${allocDocNumbers}]` : ""
    }`;

    const { data: journal, error: jErr } = await supabase
      .from("JournalEntry")
      .insert([
        {
          companyId,
          entryNo: journalNo,
          entryNumber: journalNo,
          entryDate: voucher.paymentDate,
          reference: voucher.voucherNo,
          referenceType: `PAYMENT_${voucher.mode.toUpperCase()}`,
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
        description: `[${voucher.voucherNo}] Dr ${voucher.debitAccountName} (From Cr: ${voucher.creditAccountName})`,
      },
      {
        journalEntryId: journal.id,
        accountId: voucher.creditAccountId,
        debit: 0,
        credit: Number(voucher.amount),
        description: `[${voucher.voucherNo}] Cr ${voucher.creditAccountName} (Into Dr: ${voucher.debitAccountName})`,
      },
    ]);

    for (const alloc of allocations) {
      if (alloc.docType === "INVOICE") {
        const { data: inv } = await supabase
          .from("SalesInvoice")
          .select("paid, balance, total")
          .eq("id", alloc.docId)
          .maybeSingle();
        if (inv) {
          const newPaid = Number(inv.paid || 0) + Number(alloc.allocatedAmount);
          const newBal = Math.max(0, Number(inv.total || 0) - newPaid);
          await supabase
            .from("SalesInvoice")
            .update({
              paid: newPaid,
              balance: newBal,
              status: newBal <= 0.01 ? "PAID" : "PARTIAL",
            })
            .eq("id", alloc.docId);
        }
      } else if (alloc.docType === "BILL") {
        const { data: bill } = await supabase
          .from("PurchaseBill")
          .select("paid, balance, total")
          .eq("id", alloc.docId)
          .maybeSingle();
        if (bill) {
          const newPaid = Number(bill.paid || 0) + Number(alloc.allocatedAmount);
          const newBal = Math.max(0, Number(bill.total || 0) - newPaid);
          await supabase
            .from("PurchaseBill")
            .update({
              paid: newPaid,
              balance: newBal,
              status: newBal <= 0.01 ? "PAID" : "PARTIAL",
            })
            .eq("id", alloc.docId);
        }
      }
    }

    if (voucher.bankAccountId) {
      const isMoneyIn = voucher.mode === "receive" || voucher.mode === "deposit";
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
          moneyIn: isMoneyIn ? Number(voucher.amount) : 0,
          moneyOut: !isMoneyIn ? Number(voucher.amount) : 0,
          status: voucher.method === "CHEQUE" ? "PENDING" : "CLEARED",
          journalId: journal.id,
        },
      ]);
    }

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
      `Approved! Main Journal ${journalNo} -> Sub-Voucher ${voucher.voucherNo}`
    );
    setStatusTab("POSTED");
  }

  async function handleDeleteVoucher(v: any) {
    if (v.status === "POSTED") {
      toast.error("Approved vouchers are locked to protect General Ledger integrity.");
      return;
    }
    if (!confirm(`Delete voucher ${v.voucherNo}?`)) return;
    try {
      await supabase.from("PaymentVoucher").delete().eq("id", v.id);
      toast.success(`Deleted ${v.voucherNo}.`);
      await loadWorkspaceData();
    } catch {
      toast.error("Failed to delete voucher.");
    }
  }

  // Vouchers Posted by Users that are waiting for Admin Approval
  const awaitingApprovalList = useMemo(
    () =>
      vouchers.filter(
        (v) => v.status === "UNAPPROVED" || v.status === "UNPOSTED"
      ),
    [vouchers]
  );

  const visibleVouchers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vouchers.filter((v) => {
      const normalizedStatus =
        v.status === "UNPOSTED" ? "UNAPPROVED" : v.status;
      if (normalizedStatus !== statusTab) return false;
      if (!q) return true;
      return [
        v.voucherNo,
        v.journalNo,
        v.chequeNo,
        v.customerName,
        v.supplierName,
        v.debitAccountName,
        v.creditAccountName,
        v.reference,
        v.description,
      ]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(q));
    });
  }, [vouchers, statusTab, search]);

  const cellPad = isCompact ? "py-2.5 px-4" : "py-3.5 px-5";

  return (
    <>
      <Toaster position="top-right" />
      <ERPShell title={meta.title}>
        <div className="space-y-6 relative z-10">
          {/* Header Bar */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${meta.accentBadge}`}
              >
                <ModeIcon className="w-6 h-6" />
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
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400">
                    Dedicated {mode.toUpperCase()} Module
                  </span>
                </div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {meta.title}
                </h1>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  {meta.subtitle}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {mode === "expense" && (
                <button
                  type="button"
                  onClick={() => {
                    setHeadForm({
                      parentGroup: "Operating Expense",
                      name: "",
                      code: "",
                    });
                    setShowHeadModal(true);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-600 hover:text-white text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" /> + Add Expense Head
                </button>
              )}

              {/* ADMIN-ONLY APPROVAL BOX BUTTON (Completely invisible to regular users) */}
              {canApprove && (
                <button
                  type="button"
                  onClick={() => setShowApprovalModal(true)}
                  className="px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Admin Approval Box
                  <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px]">
                    {awaitingApprovalList.length}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={openCreateModal}
                className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all"
              >
                <Plus className="w-4 h-4" /> {meta.buttonLabel}
              </button>
            </div>
          </div>

          {/* Main Ledger & Audit Trace Table */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden">
            <div className="p-5 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { id: "POSTED", label: "Approved & GL Posted" },
                    { id: "UNAPPROVED", label: "Posted (Awaiting Approval)" },
                    { id: "DRAFT", label: "Saved Drafts" },
                  ] as const
                ).map((tab) => {
                  const count = vouchers.filter((v) => {
                    const norm = v.status === "UNPOSTED" ? "UNAPPROVED" : v.status;
                    return norm === tab.id;
                  }).length;
                  const active = statusTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusTab(tab.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                        active
                          ? "bg-teal-600 text-white shadow-sm"
                          : "bg-white dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-white/10"
                      }`}
                    >
                      <span>{tab.label}</span>
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
                    placeholder="Search JE #, RE/PV #, cheque #, or account..."
                    className="w-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs outline-none focus:border-teal-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadWorkspaceData}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 hover:bg-slate-100 text-slate-700 dark:text-zinc-300 text-xs font-bold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-500" : ""}`} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 bg-slate-50/50 dark:bg-zinc-950/50">
                    <th className={cellPad}>Journal &amp; Sub-Voucher</th>
                    <th className={cellPad}>Date &amp; Mode</th>
                    <th className={cellPad}>Debit (Dr) — Where Hit</th>
                    <th className={cellPad}>Credit (Cr) — Source</th>
                    <th className={cellPad}>Allocated Docs / Notes</th>
                    <th className={`${cellPad} text-right`}>Amount</th>
                    <th className={`${cellPad} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-400 animate-pulse">
                        Loading {meta.title}...
                      </td>
                    </tr>
                  ) : visibleVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center space-y-1">
                        <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                          No vouchers in this tab
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-500">
                          Click &ldquo;+ {meta.buttonLabel}&rdquo; above to create and post a voucher.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    visibleVouchers.map((v) => {
                      const allocs = allocationsByVoucher[v.id] || [];
                      const isApproved = v.status === "POSTED";
                      const isDraft = v.status === "DRAFT";
                      return (
                        <tr
                          key={v.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors"
                        >
                          <td className={cellPad}>
                            {v.journalNo ? (
                              <div className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
                                {v.journalNo}
                              </div>
                            ) : (
                              <div className="text-[10px] font-bold text-amber-500 uppercase">
                                {isDraft ? "Draft" : "Awaiting Approval"}
                              </div>
                            )}
                            <div className="font-mono text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                              ↳ {v.voucherNo}
                            </div>
                          </td>

                          <td className={cellPad}>
                            <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                              {new Date(v.paymentDate).toISOString().slice(0, 10)}
                            </div>
                            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-300">
                              {v.method}
                            </span>
                          </td>

                          <td className={cellPad}>
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">
                              DEBIT (Dr)
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {v.debitAccountName || "—"}
                            </span>
                          </td>

                          <td className={cellPad}>
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase block">
                              CREDIT (Cr)
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {v.creditAccountName || "—"}
                            </span>
                            {(v.customerName || v.supplierName) && (
                              <span className="block text-[11px] text-slate-500">
                                Party: {v.customerName || v.supplierName}
                              </span>
                            )}
                          </td>

                          <td className={cellPad}>
                            {v.method === "CHEQUE" && (
                              <div className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400">
                                CHQ #{v.chequeNo} ({v.chequeBankName || "Bank"})
                              </div>
                            )}
                            {allocs.length > 0 ? (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {allocs.map((a: any) => (
                                  <span
                                    key={a.id}
                                    className="px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 text-[10px] font-mono font-bold text-teal-700 dark:text-teal-300"
                                  >
                                    {a.docNo}: {currency} {formatAmount(a.allocatedAmount)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">
                                {v.description || v.reference || "Direct Entry"}
                              </span>
                            )}
                          </td>

                          <td className={`${cellPad} text-right font-bold text-slate-900 dark:text-white whitespace-nowrap`}>
                            {currency} {formatAmount(v.amount)}
                          </td>

                          <td className={`${cellPad} text-right whitespace-nowrap space-x-1.5`}>
                            <button
                              type="button"
                              onClick={() => setViewingAuditVoucher(v)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 text-xs font-bold"
                              title="View Full Audit Trace"
                            >
                              <Eye className="w-3.5 h-3.5" /> Trace
                            </button>

                            {!isApproved && (
                              <>
                                {isDraft && (
                                  <button
                                    type="button"
                                    onClick={() => handleUserPostDraftRow(v)}
                                    disabled={saving}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-sm"
                                    title="Post Voucher for Approval"
                                  >
                                    <Send className="w-3 h-3" /> Post Voucher
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openEditVoucherModal(v)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 text-xs font-semibold"
                                  title="Edit Voucher"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteVoucher(v)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50/50 dark:bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 text-xs font-semibold"
                                  title="Delete Voucher"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
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

        {/* ==================== MODAL 1: CREATE / EDIT VOUCHER (USERS CAN ONLY SAVE DRAFT OR POST VOUCHER) ==================== */}
        {showFormModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                  <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">
                    {meta.title} • Sub-Voucher Prefix: {meta.voucherPrefix}xxxx
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingVoucher ? `Edit ${editingVoucher.voucherNo}` : meta.buttonLabel}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* STEP 1: PAYMENT MODE SELECTION */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">
                  1. Select Payment Mode *{" "}
                  {isStrictSettingsMode &&
                    "(Account is resolved automatically from Settings -> Accounting)"}
                </label>

                {isStrictSettingsMode ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleMethodChange("CASH")}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                        form.method === "CASH"
                          ? "bg-teal-50 dark:bg-teal-500/15 border-teal-500 text-teal-900 dark:text-teal-200 shadow-sm"
                          : "bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Wallet className="w-5 h-5 text-teal-600 shrink-0" />
                        <div>
                          <div className="text-xs font-bold">Cash Payment Mode</div>
                          <div className="text-[10px] opacity-80">
                            Auto-Credits:{" "}
                            <strong>
                              {autoResolvedSettingsAccount.cash
                                ? `${autoResolvedSettingsAccount.cash.code} - ${autoResolvedSettingsAccount.cash.name}`
                                : "Configure in Settings"}
                            </strong>
                          </div>
                        </div>
                      </div>
                      <ShieldCheck className="w-4 h-4 text-teal-500 shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMethodChange("ONLINE")}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                        form.method === "ONLINE"
                          ? "bg-indigo-50 dark:bg-indigo-500/15 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-sm"
                          : "bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Landmark className="w-5 h-5 text-indigo-500 shrink-0" />
                        <div>
                          <div className="text-xs font-bold">Online Payment Mode</div>
                          <div className="text-[10px] opacity-80">
                            Auto-Credits:{" "}
                            <strong>
                              {autoResolvedSettingsAccount.onlineGl
                                ? `${autoResolvedSettingsAccount.onlineGl.code} - ${autoResolvedSettingsAccount.onlineGl.name}`
                                : "Configure in Settings"}
                            </strong>
                          </div>
                        </div>
                      </div>
                      <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => handleMethodChange("CASH")}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                        form.method === "CASH"
                          ? "bg-teal-50 dark:bg-teal-500/15 border-teal-500 text-teal-900 dark:text-teal-200 shadow-sm"
                          : "bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400"
                      }`}
                    >
                      <Wallet className="w-5 h-5 text-teal-600 shrink-0" />
                      <div>
                        <div className="text-xs font-bold">Physical Cash</div>
                        <div className="text-[10px] opacity-75">Shows Active Cash Books Only</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMethodChange("ONLINE")}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                        form.method === "ONLINE"
                          ? "bg-teal-50 dark:bg-teal-500/15 border-teal-500 text-teal-900 dark:text-teal-200 shadow-sm"
                          : "bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400"
                      }`}
                    >
                      <Landmark className="w-5 h-5 text-indigo-500 shrink-0" />
                      <div>
                        <div className="text-xs font-bold">Online / Bank Transfer</div>
                        <div className="text-[10px] opacity-75">Shows Bank Directory Only</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMethodChange("CHEQUE")}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                        form.method === "CHEQUE"
                          ? "bg-amber-50 dark:bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-200 shadow-sm"
                          : "bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400"
                      }`}
                    >
                      <FileSpreadsheet className="w-5 h-5 text-amber-500 shrink-0" />
                      <div>
                        <div className="text-xs font-bold">Bank Cheque</div>
                        <div className="text-[10px] opacity-75">Cheque Menu + Multi-Invoice</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {!isStrictSettingsMode && form.method === "CHEQUE" && (
                <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase block mb-1">
                      Cheque Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 00458912"
                      value={form.chequeNo}
                      onChange={(e) => setForm({ ...form, chequeNo: e.target.value })}
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
                      onChange={(e) => setForm({ ...form, chequeDate: e.target.value })}
                      className="w-full bg-white dark:bg-zinc-950 border border-amber-300 dark:border-amber-500/30 rounded-lg p-2.5 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase block mb-1">
                      Drawer / Issuing Bank Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Meezan Bank / HBL"
                      value={form.chequeBankName}
                      onChange={(e) => setForm({ ...form, chequeBankName: e.target.value })}
                      className="w-full bg-white dark:bg-zinc-950 border border-amber-300 dark:border-amber-500/30 rounded-lg p-2.5 outline-none"
                    />
                  </div>
                </div>
              )}

              <div
                className={`grid grid-cols-1 ${
                  isStrictSettingsMode ? "sm:grid-cols-2" : "sm:grid-cols-3"
                } gap-4 text-xs`}
              >
                {!isStrictSettingsMode && (
                  <div>
                    <label className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase block mb-1.5">
                      {form.method === "CASH"
                        ? "Active Cash Book Only *"
                        : "Bank Directory Account Only *"}
                    </label>
                    {form.method === "CASH" ? (
                      <select
                        value={form.accountId}
                        onChange={(e) => setForm({ ...form, accountId: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 font-semibold outline-none focus:border-teal-500"
                      >
                        <option value="">-- Select Active Cash Book --</option>
                        {activeCashAccounts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} — {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={form.accountId}
                        onChange={(e) => setForm({ ...form, accountId: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 font-semibold outline-none focus:border-teal-500"
                      >
                        <option value="">-- Select Registered Bank Account --</option>
                        {bankAccounts.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.bankName} — {b.accountTitle} ({b.accountNumber})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Voucher Date *
                  </label>
                  <input
                    type="date"
                    value={form.paymentDate}
                    onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase block mb-1.5">
                    Total Voucher Amount ({currency}) *
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

              {(mode === "receive" || mode === "supplier") && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      {mode === "receive"
                        ? "Filter by Customer (Select one or multiple invoices below)"
                        : "Filter by Supplier & Allocate Payment Against Bills Below"}
                    </label>
                    <select
                      value={mode === "receive" ? form.customerId : form.supplierId}
                      onChange={(e) => {
                        if (mode === "receive")
                          setForm({ ...form, customerId: e.target.value });
                        else setForm({ ...form, supplierId: e.target.value });
                      }}
                      className="bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none"
                    >
                      <option value="">
                        {mode === "receive" ? "All Customers" : "All Suppliers"}
                      </option>
                      {(mode === "receive" ? customers : suppliers).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 dark:bg-zinc-950 sticky top-0 border-b border-slate-200 dark:border-white/10 text-[10px] font-bold uppercase text-slate-500">
                        <tr>
                          <th className="py-2 px-3 w-10">Select</th>
                          <th className="py-2 px-3">
                            {mode === "receive" ? "Invoice #" : "Bill #"}
                          </th>
                          <th className="py-2 px-3">Party</th>
                          <th className="py-2 px-3 text-right">Total</th>
                          <th className="py-2 px-3 text-right">Outstanding Due</th>
                          <th className="py-2 px-3 text-right w-36">
                            Allocate Amount ({currency})
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                        {partyDocuments.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400">
                              No outstanding {mode === "receive" ? "invoices" : "bills"} found.
                            </td>
                          </tr>
                        ) : (
                          partyDocuments.map((doc) => {
                            const checked = selectedDocs[doc.id] !== undefined;
                            const docNumber = doc.invoiceNo || doc.billNo;
                            const partyName =
                              mode === "receive"
                                ? customers.find((c) => c.id === doc.customerId)?.name
                                : suppliers.find((s) => s.id === doc.supplierId)?.name;

                            return (
                              <tr
                                key={doc.id}
                                className={
                                  checked
                                    ? "bg-teal-50/50 dark:bg-teal-500/10"
                                    : "hover:bg-slate-50 dark:hover:bg-white/5"
                                }
                              >
                                <td className="py-2 px-3">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleDocumentSelection(doc)}
                                    className="w-4 h-4 accent-teal-500 rounded cursor-pointer"
                                  />
                                </td>
                                <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white">
                                  {docNumber}
                                </td>
                                <td className="py-2 px-3 text-slate-600 dark:text-zinc-300">
                                  {partyName || "—"}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-500">
                                  {currency} {formatAmount(doc.total)}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-rose-600 dark:text-rose-400">
                                  {currency} {formatAmount(doc.balance)}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  {checked ? (
                                    <input
                                      type="number"
                                      min="0.01"
                                      max={Number(doc.balance)}
                                      step="0.01"
                                      value={selectedDocs[doc.id]}
                                      onChange={(e) =>
                                        updateDocAllocationAmount(doc.id, e.target.value)
                                      }
                                      className="w-28 bg-white dark:bg-zinc-900 border border-teal-400 rounded px-2 py-1 text-right font-bold outline-none"
                                    />
                                  ) : (
                                    <span className="text-slate-400">—</span>
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
              )}

              {mode === "expense" && (
                <div className="p-4 rounded-xl bg-amber-50/40 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase">
                      2. Select Parent Expense Account &amp; Expense Head
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setHeadForm({
                          parentGroup: form.expenseParentGroup,
                          name: "",
                          code: "",
                        });
                        setShowHeadModal(true);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" /> + Create New Expense Head
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(
                      [
                        "Cost of Sales",
                        "Operating Expense",
                        "Finance Expense",
                      ] as ExpenseParentGroup[]
                    ).map((grp) => (
                      <button
                        key={grp}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            expenseParentGroup: grp,
                            expenseAccountId: "",
                          })
                        }
                        className={`p-3 rounded-xl border text-left transition-all ${
                          form.expenseParentGroup === grp
                            ? "bg-white dark:bg-zinc-900 border-amber-500 ring-2 ring-amber-500/20 shadow-sm"
                            : "bg-slate-50/70 dark:bg-zinc-950 border-slate-200 dark:border-white/10 opacity-75"
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {grp} ({EXPENSE_PARENT_META[grp].codePrefix}xx)
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {EXPENSE_PARENT_META[grp].desc}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Expense Head under {form.expenseParentGroup} *
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={form.expenseAccountId}
                        onChange={(e) => {
                          if (e.target.value === "__NEW__") {
                            setHeadForm({
                              parentGroup: form.expenseParentGroup,
                              name: "",
                              code: "",
                            });
                            setShowHeadModal(true);
                          } else {
                            setForm({ ...form, expenseAccountId: e.target.value });
                          }
                        }}
                        className="flex-1 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-xs font-semibold outline-none focus:border-teal-500 cursor-pointer"
                      >
                        <option value="">
                          -- Select Expense Head ({expenseAccountsByParent.length} available) --
                        </option>
                        <option value="__NEW__" className="font-bold text-teal-600">
                          + Create New Expense Head under {form.expenseParentGroup}...
                        </option>
                        {expenseAccountsByParent.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          setHeadForm({
                            parentGroup: form.expenseParentGroup,
                            name: "",
                            code: "",
                          });
                          setShowHeadModal(true);
                        }}
                        className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shrink-0"
                      >
                        + New Head
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {mode === "deposit" && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Credit Account (Source of Direct Deposit) *
                  </label>
                  <select
                    value={form.depositSourceAccountId}
                    onChange={(e) =>
                      setForm({ ...form, depositSourceAccountId: e.target.value })
                    }
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-xs font-semibold outline-none focus:border-teal-500"
                  >
                    <option value="">-- Select Source GL Account (Credit) --</option>
                    {allAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    External Receipt / Slip Reference
                  </label>
                  <input
                    type="text"
                    placeholder="Optional bank TXN ID or book ref..."
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 font-mono outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Audit Narration / Notes
                  </label>
                  <input
                    type="text"
                    placeholder="Details for audit trail..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* STRICT USER BUTTONS: ONLY SAVE DRAFT OR POST VOUCHER (NEVER APPROVE) */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleUserSaveOrPost("DRAFT")}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-zinc-200 text-xs font-bold hover:bg-slate-200 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save as Draft"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleUserSaveOrPost("UNAPPROVED")}
                  className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-teal-500/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {saving ? "Posting..." : "Post Voucher"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== MODAL 2: HIERARCHICAL EXPENSE HEAD CREATOR ==================== */}
        {showHeadModal && (
          <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Create New Expense Head
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Choose a parent account and enter the new expense head name.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHeadModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateExpenseHead} className="space-y-4 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Parent Expense Account *
                  </label>
                  <select
                    value={headForm.parentGroup}
                    onChange={(e) =>
                      setHeadForm({
                        ...headForm,
                        parentGroup: e.target.value as ExpenseParentGroup,
                      })
                    }
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 font-bold outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="Cost of Sales">Cost of Sales (51xx)</option>
                    <option value="Operating Expense">Operating Expense (52xx)</option>
                    <option value="Finance Expense">Finance Expense (53xx)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Expense Head Name *
                  </label>
                  <input
                    required
                    autoFocus
                    placeholder="e.g. Packaging Boxes, Office Rent, Bank Charges"
                    value={headForm.name}
                    onChange={(e) => setHeadForm({ ...headForm, name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    GL Code (Optional — Auto-generated if left blank)
                  </label>
                  <input
                    placeholder={`Auto (${EXPENSE_PARENT_META[headForm.parentGroup].codePrefix}xx)`}
                    value={headForm.code}
                    onChange={(e) => setHeadForm({ ...headForm, code: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 font-mono outline-none focus:border-teal-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowHeadModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={headSaving}
                    className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-lg shadow-teal-500/20"
                  >
                    {headSaving ? "Creating..." : "Create & Select Head"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================== MODAL 3: ADMIN-ONLY APPROVAL BOX ==================== */}
        {showApprovalModal && canApprove && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl max-h-[88vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-amber-500" />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Admin Voucher Approval Box ({meta.title})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Review vouchers posted by users. Approving generates a Main Journal No (JE-xxxx) and commits to the General Ledger.
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

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10 text-[10px] font-bold uppercase text-slate-500">
                      <th className="py-2.5 px-3">Sub-Voucher</th>
                      <th className="py-2.5 px-3">Date / Mode</th>
                      <th className="py-2.5 px-3">Debit &rarr; Credit</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-right">Admin Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                    {awaitingApprovalList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          No posted vouchers waiting for Admin approval in {meta.title}.
                        </td>
                      </tr>
                    ) : (
                      awaitingApprovalList.map((v) => (
                        <tr key={v.id}>
                          <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                            {v.voucherNo}
                          </td>
                          <td className="py-3 px-3">
                            {new Date(v.paymentDate).toISOString().slice(0, 10)} ({v.method})
                          </td>
                          <td className="py-3 px-3">
                            <div className="text-emerald-600 font-semibold">
                              Dr: {v.debitAccountName}
                            </div>
                            <div className="text-indigo-500 font-semibold">
                              Cr: {v.creditAccountName}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                            {currency} {formatAmount(v.amount)}
                          </td>
                          <td className="py-3 px-3 text-right space-x-2">
                            <button
                              type="button"
                              onClick={async () => {
                                await executeAdminApprove(v);
                                await loadWorkspaceData();
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approve Voucher
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteVoucher(v)}
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
          </div>
        )}

        {/* ==================== MODAL 4: AUDIT TRACE DRAWER ==================== */}
        {viewingAuditVoucher && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                  <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">
                    Double-Entry Audit Trail
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Voucher Trace: {viewingAuditVoucher.voucherNo}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingAuditVoucher(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 space-y-3 text-xs font-mono">
                <div className="flex justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                  <span className="text-slate-500">Main Journal No:</span>
                  <strong className="text-teal-600 dark:text-teal-400">
                    {viewingAuditVoucher.journalNo || "AWAITING ADMIN APPROVAL"}
                  </strong>
                </div>
                <div className="flex justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                  <span className="text-slate-500">Sub-Voucher / Receipt No:</span>
                  <strong className="text-slate-900 dark:text-white">
                    {viewingAuditVoucher.voucherNo}
                  </strong>
                </div>
                <div className="flex justify-between border-b border-slate-200 dark:border-white/10 pb-2">
                  <span className="text-slate-500">Instrument / Mode:</span>
                  <strong className="text-slate-900 dark:text-white">
                    {viewingAuditVoucher.method}
                    {viewingAuditVoucher.chequeNo
                      ? ` (Cheque #${viewingAuditVoucher.chequeNo})`
                      : ""}
                  </strong>
                </div>

                <div className="pt-2 space-y-2">
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block">
                        DEBIT (Dr)
                      </span>
                      <strong className="text-slate-900 dark:text-white">
                        {viewingAuditVoucher.debitAccountName}
                      </strong>
                    </div>
                    <strong className="text-emerald-700 dark:text-emerald-400">
                      {currency} {formatAmount(viewingAuditVoucher.amount)}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 flex justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 block">
                        CREDIT (Cr)
                      </span>
                      <strong className="text-slate-900 dark:text-white">
                        {viewingAuditVoucher.creditAccountName}
                      </strong>
                    </div>
                    <strong className="text-indigo-700 dark:text-indigo-400">
                      {currency} {formatAmount(viewingAuditVoucher.amount)}
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