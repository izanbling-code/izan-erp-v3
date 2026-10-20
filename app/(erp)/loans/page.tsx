"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Toaster, toast } from "react-hot-toast";
import ERPShell from "@/app/components/erp-shell";
import { supabase } from "@/app/lib/supabase";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import { Plus, Calendar, History, CheckCircle2, Clock, Landmark, ArrowUpRight, Settings2, X } from "lucide-react";

export default function LoansModulePage() {
  const { settings, formatAmount, currency } = useERPConfig();

  const [companyId, setCompanyId] = useState<string>("");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [repayments, setRepayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modals
  const [showNewLoanModal, setShowNewLoanModal] = useState(false);
  const [showRepayModal, setShowRepayModal] = useState<any>(null);
  const [selectedLoanHistory, setSelectedLoanHistory] = useState<any>(null);

  // Settings pulled directly from SettingsContext (configured in /settings)
  const defaultLiabilityAccountId = settings?.accounting?.loanLiabilityAccountId || "";
  const defaultDepositAccountId = settings?.accounting?.loanDepositAccountId || "";
  const loanPrefix = settings?.numbering?.loanPrefix || "LN-";
  const journalPrefix = settings?.numbering?.journalPrefix || "JE-";
  const isCompact = settings?.appearance?.dataDensity === "compact";

  // New Loan Form
  const [loanForm, setLoanForm] = useState({
    partyName: "",
    lenderPhone: "",
    principal: "",
    monthlyInstallment: "",
    durationMonths: "12",
    dueDay: "1",
    issueDate: new Date().toISOString().split("T")[0],
    depositAccountId: "",
    liabilityAccountId: "",
    referenceNo: "",
    notes: "",
  });

  // Repayment Form
  const [repayForm, setRepayForm] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentAccountId: "",
    referenceNo: "",
    notes: "",
  });

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      // 1. Load existing Chart of Accounts from /api/accounts (with Supabase fallback)
      let coaList: any[] = [];
      try {
        const res = await fetch("/api/accounts");
        const d = await res.json();
        coaList = d.accounts || (Array.isArray(d) ? d : []);
      } catch {
        const { data: accs } = await supabase.from("Account").select("*").order("code");
        coaList = accs || [];
      }
      setAccounts(coaList);

      // 2. Get Company ID & BankAccounts (for optional BankTransaction syncing)
      const { data: comp } = await supabase.from("Company").select("id").limit(1).maybeSingle();
      setCompanyId(comp?.id || coaList[0]?.companyId || "001");

      const { data: banks } = await supabase.from("BankAccount").select("*");
      setBankAccounts(banks || []);

      // 3. Load Loans & Repayments
      const { data: loanRows } = await supabase
        .from("Loan")
        .select("*")
        .order("issueDate", { ascending: false });

      const { data: repayRows } = await supabase
        .from("LoanRepayment")
        .select("*")
        .order("date", { ascending: false });

      setLoans(loanRows || []);
      setRepayments(repayRows || []);
    } catch (err) {
      console.error("Failed to load loan data:", err);
      toast.error("Failed to load loans.");
    } finally {
      setLoading(false);
    }
  }

  function openNewLoanModal() {
    setLoanForm({
      partyName: "",
      lenderPhone: "",
      principal: "",
      monthlyInstallment: "",
      durationMonths: "12",
      dueDay: "1",
      issueDate: new Date().toISOString().split("T")[0],
      depositAccountId: defaultDepositAccountId,
      liabilityAccountId: defaultLiabilityAccountId,
      referenceNo: "",
      notes: "",
    });
    setShowNewLoanModal(true);
  }

  function handlePrincipalOrDurationChange(field: "principal" | "durationMonths", value: string) {
    const updated = { ...loanForm, [field]: value };
    const p = parseFloat(updated.principal) || 0;
    const m = parseInt(updated.durationMonths) || 1;
    if (p > 0 && m > 0) {
      updated.monthlyInstallment = Math.ceil(p / m).toString();
    }
    setLoanForm(updated);
  }

  async function handleCreateLoan(e: React.FormEvent) {
    e.preventDefault();
    const principalAmt = parseFloat(loanForm.principal);

    if (!loanForm.partyName || !principalAmt || principalAmt <= 0) {
      toast.error("Please enter the Lender Name and a valid Loan Amount.");
      return;
    }
    if (!loanForm.depositAccountId || !loanForm.liabilityAccountId) {
      toast.error("Please select both the Deposit Account and Loan Liability Account from your Chart of Accounts.");
      return;
    }

    setSaving(true);
    try {
      const nextNum = `${loanPrefix}${String(loans.length + 1).padStart(4, "0")}`;

      // 1. Post Journal Entry to Balance Sheet (Debit Deposit/Bank Asset, Credit Loan Liability)
      const { data: journal, error: jErr } = await supabase
        .from("JournalEntry")
        .insert([
          {
            companyId,
            entryNo: `${journalPrefix}${nextNum}`,
            entryNumber: `${journalPrefix}${nextNum}`,
            entryDate: new Date(loanForm.issueDate).toISOString(),
            description: `Loan taken from ${loanForm.partyName} (${nextNum})`,
            status: "POSTED",
            reference: loanForm.referenceNo || nextNum,
            referenceType: "LOAN_RECEIVED",
          },
        ])
        .select()
        .single();

      if (jErr) throw jErr;

      const { data: jLines, error: jlErr } = await supabase
        .from("JournalLine")
        .insert([
          {
            journalEntryId: journal.id,
            accountId: loanForm.depositAccountId,
            debit: principalAmt,
            credit: 0,
            description: `Loan funds deposited from ${loanForm.partyName}`,
          },
          {
            journalEntryId: journal.id,
            accountId: loanForm.liabilityAccountId,
            debit: 0,
            credit: principalAmt,
            description: `Loan payable liability to ${loanForm.partyName}`,
          },
        ])
        .select();

      if (jlErr) throw jlErr;

      // 2. If this Chart of Account is linked to a BankAccount in Banking, also log a BankTransaction
      const linkedBank = bankAccounts.find(
        (b) => b.glAccountId === loanForm.depositAccountId || b.id === loanForm.depositAccountId
      );
      if (linkedBank) {
        await supabase.from("BankTransaction").insert([
          {
            companyId,
            bankAccountId: linkedBank.id,
            journalLineId: jLines?.[0]?.id || null,
            transactionDate: new Date(loanForm.issueDate).toISOString(),
            reference: loanForm.referenceNo || nextNum,
            description: `Loan received from ${loanForm.partyName} (${nextNum})`,
            instrumentType: "ONLINE_TRANSFER",
            moneyIn: principalAmt,
            moneyOut: 0,
            status: "CLEARED",
          },
        ]);
      }

      // 3. Save Loan Record
      const { error: loanErr } = await supabase.from("Loan").insert([
        {
          companyId,
          loanNumber: nextNum,
          type: "BORROWED",
          partyName: loanForm.partyName,
          lenderPhone: loanForm.lenderPhone,
          principal: principalAmt,
          balance: principalAmt,
          monthlyInstallment: parseFloat(loanForm.monthlyInstallment) || 0,
          durationMonths: parseInt(loanForm.durationMonths) || 12,
          dueDay: parseInt(loanForm.dueDay) || 1,
          issueDate: new Date(loanForm.issueDate).toISOString(),
          status: "APPROVED",
          referenceNo: loanForm.referenceNo || nextNum,
          accountId: loanForm.depositAccountId,
          liabilityAccountId: loanForm.liabilityAccountId,
          notes: loanForm.notes,
          journalId: journal.id,
        },
      ]);

      if (loanErr) throw loanErr;

      toast.success("Loan recorded and posted to Balance Sheet!");
      setShowNewLoanModal(false);
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save loan.");
    } finally {
      setSaving(false);
    }
  }

  function openRepayModal(loan: any) {
    const suggested =
      Number(loan.monthlyInstallment) > 0 && Number(loan.monthlyInstallment) <= Number(loan.balance)
        ? Number(loan.monthlyInstallment)
        : Number(loan.balance);

    setRepayForm({
      amount: String(suggested),
      date: new Date().toISOString().split("T")[0],
      paymentAccountId: loan.accountId || defaultDepositAccountId || "",
      referenceNo: "",
      notes: `Monthly installment paid to ${loan.partyName}`,
    });
    setShowRepayModal(loan);
  }

  async function handleRepayLoan(e: React.FormEvent) {
    e.preventDefault();
    if (!showRepayModal) return;

    const payAmt = parseFloat(repayForm.amount);
    const currentBal = Number(showRepayModal.balance);

    if (!payAmt || payAmt <= 0 || payAmt > currentBal) {
      toast.error(`Amount must be between 1 and ${formatAmount(currentBal)}`);
      return;
    }

    const liabilityAccId = showRepayModal.liabilityAccountId || defaultLiabilityAccountId;
    if (!repayForm.paymentAccountId || !liabilityAccId) {
      toast.error("Please select the Bank/Cash Account and ensure a Loan Liability Account is set in Settings.");
      return;
    }

    setSaving(true);
    try {
      const refCode =
        repayForm.referenceNo || `REP-${showRepayModal.loanNumber}-${Date.now().toString().slice(-4)}`;

      // 1. Post Journal Entry (Debit Loan Liability to reduce debt, Credit Bank/Cash Asset)
      const { data: journal, error: jErr } = await supabase
        .from("JournalEntry")
        .insert([
          {
            companyId,
            entryNo: `${journalPrefix}${refCode}`,
            entryNumber: `${journalPrefix}${refCode}`,
            entryDate: new Date(repayForm.date).toISOString(),
            description: `Loan installment paid to ${showRepayModal.partyName} (${showRepayModal.loanNumber})`,
            status: "POSTED",
            reference: refCode,
            referenceType: "LOAN_REPAYMENT",
            referenceId: showRepayModal.id,
          },
        ])
        .select()
        .single();

      if (jErr) throw jErr;

      const { data: jLines, error: jlErr } = await supabase
        .from("JournalLine")
        .insert([
          {
            journalEntryId: journal.id,
            accountId: liabilityAccId,
            debit: payAmt,
            credit: 0,
            description: `Loan liability reduction - ${showRepayModal.partyName}`,
          },
          {
            journalEntryId: journal.id,
            accountId: repayForm.paymentAccountId,
            debit: 0,
            credit: payAmt,
            description: `Loan repayment outflow - ${showRepayModal.loanNumber}`,
          },
        ])
        .select();

      if (jlErr) throw jlErr;

      // 2. If linked to a BankAccount, log BankTransaction (Money Out)
      const linkedBank = bankAccounts.find(
        (b) => b.glAccountId === repayForm.paymentAccountId || b.id === repayForm.paymentAccountId
      );
      if (linkedBank) {
        await supabase.from("BankTransaction").insert([
          {
            companyId,
            bankAccountId: linkedBank.id,
            journalLineId: jLines?.[1]?.id || null,
            transactionDate: new Date(repayForm.date).toISOString(),
            reference: refCode,
            description: `Loan installment paid to ${showRepayModal.partyName} (${showRepayModal.loanNumber})`,
            instrumentType: "ONLINE_TRANSFER",
            moneyIn: 0,
            moneyOut: payAmt,
            status: "CLEARED",
          },
        ]);
      }

      // 3. Insert LoanRepayment
      const { error: repErr } = await supabase.from("LoanRepayment").insert([
        {
          loanId: showRepayModal.id,
          date: new Date(repayForm.date).toISOString(),
          amount: payAmt,
          method: "BANK_TRANSFER",
          accountId: repayForm.paymentAccountId,
          status: "APPROVED",
          referenceNo: refCode,
          notes: repayForm.notes,
          journalId: journal.id,
        },
      ]);

      if (repErr) throw repErr;

      // 4. Update Loan Remaining Balance
      const newBalance = Math.max(0, currentBal - payAmt);
      await supabase.from("Loan").update({ balance: newBalance }).eq("id", showRepayModal.id);

      toast.success("Installment paid & Balance Sheet updated!");
      setShowRepayModal(null);
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || "Failed to record repayment.");
    } finally {
      setSaving(false);
    }
  }

  function isPaidThisMonth(loanId: string) {
    const now = new Date();
    return repayments.some((r) => {
      if (r.loanId !== loanId) return false;
      const d = new Date(r.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }

  function getAccountName(accountId: string) {
    const found = accounts.find((a) => a.id === accountId);
    if (found) return `${found.code ? found.code + " - " : ""}${found.name}`;
    return "Not Selected";
  }

  // Metrics
  const totalBorrowed = loans.reduce((sum, l) => sum + Number(l.principal || 0), 0);
  const totalLiability = loans.reduce((sum, l) => sum + Number(l.balance || 0), 0);
  const totalRepaid = totalBorrowed - totalLiability;
  const activeLoans = loans.filter((l) => Number(l.balance) > 0);
  const dueThisMonth = activeLoans.reduce((sum, l) => {
    if (isPaidThisMonth(l.id)) return sum;
    return sum + Math.min(Number(l.monthlyInstallment || 0), Number(l.balance || 0));
  }, 0);

  const cellPad = isCompact ? "py-2 px-3" : "py-3.5 px-5";

  return (
    <>
      <Toaster position="top-right" />
      <ERPShell title="Loans & Monthly Repayments">
        <div className="space-y-6 relative z-10">
          {/* Top Action Bar & Settings Status */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Business Borrowings & Monthly Repayment Schedule
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-zinc-400 mt-1">
                <span>
                  Default Deposit Account:{" "}
                  <strong className="text-slate-700 dark:text-zinc-200">
                    {defaultDepositAccountId ? getAccountName(defaultDepositAccountId) : "Not set in Settings"}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Default Liability Account:{" "}
                  <strong className="text-slate-700 dark:text-zinc-200">
                    {defaultLiabilityAccountId ? getAccountName(defaultLiabilityAccountId) : "Not set in Settings"}
                  </strong>
                </span>
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 font-semibold hover:underline"
                >
                  <Settings2 className="w-3.5 h-3.5" /> Change in Settings
                </Link>
              </div>
            </div>

            <button
              onClick={openNewLoanModal}
              className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" /> Record New Loan
            </button>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5">
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                Balance Sheet Loan Liability
              </span>
              <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1.5">
                {currency} {formatAmount(totalLiability)}
              </p>
              <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                {activeLoans.length} active loan(s) owed
              </span>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5">
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                Installments Due This Month
              </span>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1.5">
                {currency} {formatAmount(dueThisMonth)}
              </p>
              <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                Remaining monthly schedule
              </span>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5">
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                Total Borrowed (Bank Inflow)
              </span>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
                {currency} {formatAmount(totalBorrowed)}
              </p>
              <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                Verified loan deposits
              </span>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5">
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                Total Repaid to Lenders
              </span>
              <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 mt-1.5">
                {currency} {formatAmount(totalRepaid)}
              </p>
              <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                {repayments.length} installment(s) completed
              </span>
            </div>
          </div>

          {/* Monthly Payment Schedule Section */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden">
            <div className="p-6 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Monthly Payment Schedule
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Track and pay monthly installments for each person you borrowed from.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {activeLoans.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500 dark:text-zinc-400">
                  No active loans with pending monthly installments.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {activeLoans.map((loan) => {
                    const paidThisMonth = isPaidThisMonth(loan.id);
                    const principal = Number(loan.principal || 1);
                    const balance = Number(loan.balance || 0);
                    const paidAmt = principal - balance;
                    const pct = Math.min(100, Math.round((paidAmt / principal) * 100));

                    return (
                      <div
                        key={loan.id}
                        className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950/50 p-5 shadow-inner flex flex-col justify-between space-y-4"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-slate-500 dark:text-zinc-400">
                              {loan.loanNumber}
                            </span>
                            {paidThisMonth ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-500/30">
                                <CheckCircle2 className="w-3 h-3" /> Paid This Month
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                                <Clock className="w-3 h-3" /> Due Day {loan.dueDay || 1}
                              </span>
                            )}
                          </div>

                          <h4 className="text-base font-bold text-slate-900 dark:text-white mt-2">
                            {loan.partyName}
                          </h4>
                          {loan.lenderPhone && (
                            <p className="text-xs text-slate-500 dark:text-zinc-400">{loan.lenderPhone}</p>
                          )}

                          <div className="mt-4 space-y-1.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-500 dark:text-zinc-400">Monthly Installment:</span>
                              <span className="font-bold text-slate-900 dark:text-white">
                                {currency} {formatAmount(loan.monthlyInstallment || 0)} / mo
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500 dark:text-zinc-400">Remaining Payable:</span>
                              <span className="font-bold text-rose-600 dark:text-rose-400">
                                {currency} {formatAmount(balance)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500 dark:text-zinc-400">Deposited In:</span>
                              <span className="font-medium text-slate-700 dark:text-zinc-300 truncate max-w-[160px]">
                                {getAccountName(loan.accountId)}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4">
                            <div className="flex justify-between text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                              <span>Repaid {pct}%</span>
                              <span>
                                {currency} {formatAmount(paidAmt)} / {formatAmount(principal)}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-teal-500 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <button
                            onClick={() => openRepayModal(loan)}
                            className="flex-1 bg-teal-600 hover:bg-teal-500 text-white py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" /> Pay Installment
                          </button>
                          <button
                            onClick={() => setSelectedLoanHistory(loan)}
                            className="py-2 px-3 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-zinc-300 text-xs font-semibold transition-all flex items-center gap-1"
                          >
                            <History className="w-3.5 h-3.5" /> Ledger
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* All Loans & Bank Proof Register */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden">
            <div className="p-6 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Landmark className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Loans Register & Bank Deposit Trail
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Complete history of borrowed funds, receiving Chart of Accounts, and Balance Sheet liability balances.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 bg-slate-50/50 dark:bg-zinc-950/50">
                    <th className={cellPad}>Loan #</th>
                    <th className={cellPad}>Lender / Person</th>
                    <th className={cellPad}>Date Received</th>
                    <th className={cellPad}>Deposit Account (COA)</th>
                    <th className={cellPad}>Liability Account (COA)</th>
                    <th className={`${cellPad} text-right`}>Principal</th>
                    <th className={`${cellPad} text-right`}>Monthly Plan</th>
                    <th className={`${cellPad} text-right`}>Balance Owed</th>
                    <th className={`${cellPad} text-center`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-400 dark:text-zinc-500">
                        Loading loan records...
                      </td>
                    </tr>
                  ) : loans.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-400 dark:text-zinc-500">
                        No loans recorded yet.
                      </td>
                    </tr>
                  ) : (
                    loans.map((loan) => {
                      const isCleared = Number(loan.balance) <= 0;
                      return (
                        <tr
                          key={loan.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors"
                        >
                          <td className={`${cellPad} font-mono text-xs font-bold text-slate-700 dark:text-zinc-300`}>
                            {loan.loanNumber}
                          </td>
                          <td className={cellPad}>
                            <div className="font-bold text-slate-900 dark:text-white">{loan.partyName}</div>
                            {loan.notes && (
                              <div className="text-xs text-slate-500 dark:text-zinc-400">{loan.notes}</div>
                            )}
                          </td>
                          <td className={`${cellPad} text-slate-600 dark:text-zinc-300`}>
                            {new Date(loan.issueDate).toLocaleDateString()}
                          </td>
                          <td className={`${cellPad} text-slate-700 dark:text-zinc-300 text-xs`}>
                            {getAccountName(loan.accountId)}
                          </td>
                          <td className={`${cellPad} text-slate-700 dark:text-zinc-300 text-xs`}>
                            {getAccountName(loan.liabilityAccountId || defaultLiabilityAccountId)}
                          </td>
                          <td className={`${cellPad} text-right font-semibold text-slate-900 dark:text-white`}>
                            {currency} {formatAmount(loan.principal)}
                          </td>
                          <td className={`${cellPad} text-right text-slate-700 dark:text-zinc-300`}>
                            {currency} {formatAmount(loan.monthlyInstallment || 0)}
                            <span className="block text-[10px] text-slate-400">Day {loan.dueDay || 1}</span>
                          </td>
                          <td className={`${cellPad} text-right font-bold`}>
                            {isCleared ? (
                              <span className="text-teal-600 dark:text-teal-400">SETTLED</span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400">
                                {currency} {formatAmount(loan.balance)}
                              </span>
                            )}
                          </td>
                          <td className={`${cellPad} text-center space-x-2`}>
                            {!isCleared && (
                              <button
                                onClick={() => openRepayModal(loan)}
                                className="px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 text-teal-700 dark:text-teal-400 hover:bg-teal-600 hover:text-white text-xs font-bold transition-all"
                              >
                                Pay
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedLoanHistory(loan)}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-semibold transition-all"
                            >
                              History
                            </button>
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

        {/* MODAL 1: Record New Loan */}
        {showNewLoanModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Record New Loan Taken</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Posts directly to your selected Chart of Accounts & Balance Sheet.
                  </p>
                </div>
                <button
                  onClick={() => setShowNewLoanModal(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateLoan} className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Person / Lender Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ahmed Khan"
                      value={loanForm.partyName}
                      onChange={(e) => setLoanForm({ ...loanForm, partyName: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      placeholder="0300-0000000"
                      value={loanForm.lenderPhone}
                      onChange={(e) => setLoanForm({ ...loanForm, lenderPhone: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Loan Amount ({currency}) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={loanForm.principal}
                      onChange={(e) => handlePrincipalOrDurationChange("principal", e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Months Plan
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={loanForm.durationMonths}
                      onChange={(e) => handlePrincipalOrDurationChange("durationMonths", e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase block mb-1.5">
                      Monthly Installment *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={loanForm.monthlyInstallment}
                      onChange={(e) => setLoanForm({ ...loanForm, monthlyInstallment: e.target.value })}
                      className="w-full bg-teal-50/50 dark:bg-teal-500/10 text-teal-900 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Date Received *
                    </label>
                    <input
                      type="date"
                      required
                      value={loanForm.issueDate}
                      onChange={(e) => setLoanForm({ ...loanForm, issueDate: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Monthly Due Day (1-28)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="28"
                      value={loanForm.dueDay}
                      onChange={(e) => setLoanForm({ ...loanForm, dueDay: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Deposit Into Account (From Your Chart of Accounts) *
                  </label>
                  <select
                    required
                    value={loanForm.depositAccountId}
                    onChange={(e) => setLoanForm({ ...loanForm, depositAccountId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                  >
                    <option value="">Select Bank / Cash Account...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code ? a.code + " - " : ""}
                        {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Loan Payable Liability Account (From Your Chart of Accounts) *
                  </label>
                  <select
                    required
                    value={loanForm.liabilityAccountId}
                    onChange={(e) => setLoanForm({ ...loanForm, liabilityAccountId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                  >
                    <option value="">Select Liability Account...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code ? a.code + " - " : ""}
                        {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Reference / Transfer Notes
                  </label>
                  <input
                    type="text"
                    placeholder="Bank transfer reference or agreement notes"
                    value={loanForm.notes}
                    onChange={(e) => setLoanForm({ ...loanForm, notes: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowNewLoanModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-teal-500/20 disabled:opacity-50"
                  >
                    {saving ? "Posting..." : "Save Loan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: Pay Monthly Installment */}
        {showRepayModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Pay Monthly Installment</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {showRepayModal.partyName} ({showRepayModal.loanNumber})
                  </p>
                </div>
                <button
                  onClick={() => setShowRepayModal(null)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRepayLoan} className="space-y-4 text-sm">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-zinc-400 font-semibold">Remaining Balance:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">
                    {currency} {formatAmount(showRepayModal.balance)}
                  </span>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Installment Amount ({currency}) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={Number(showRepayModal.balance)}
                    step="any"
                    value={repayForm.amount}
                    onChange={(e) => setRepayForm({ ...repayForm, amount: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={repayForm.date}
                    onChange={(e) => setRepayForm({ ...repayForm, date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Pay From Account (Chart of Accounts) *
                  </label>
                  <select
                    required
                    value={repayForm.paymentAccountId}
                    onChange={(e) => setRepayForm({ ...repayForm, paymentAccountId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                  >
                    <option value="">Select Bank / Cash Account...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code ? a.code + " - " : ""}
                        {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Notes / Transfer Reference
                  </label>
                  <input
                    type="text"
                    value={repayForm.notes}
                    onChange={(e) => setRepayForm({ ...repayForm, notes: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowRepayModal(null)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-teal-500/20 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Confirm Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: Loan Repayment History */}
        {selectedLoanHistory && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Repayment Ledger: {selectedLoanHistory.partyName} ({selectedLoanHistory.loanNumber})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Principal: {currency} {formatAmount(selectedLoanHistory.principal)} | Remaining:{" "}
                    <strong className="text-rose-600 dark:text-rose-400">
                      {currency} {formatAmount(selectedLoanHistory.balance)}
                    </strong>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLoanHistory(null)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Paid From Account</th>
                    <th className="py-2.5 px-3">Notes</th>
                    <th className="py-2.5 px-3 text-right">Amount Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                  {repayments.filter((r) => r.loanId === selectedLoanHistory.id).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 dark:text-zinc-500">
                        No repayments recorded for this loan yet.
                      </td>
                    </tr>
                  ) : (
                    repayments
                      .filter((r) => r.loanId === selectedLoanHistory.id)
                      .map((r) => (
                        <tr key={r.id}>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-zinc-300">
                            {new Date(r.date).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-xs text-slate-500">{r.referenceNo}</td>
                          <td className="py-2.5 px-3 text-xs text-slate-600 dark:text-zinc-300">
                            {getAccountName(r.accountId)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-400">{r.notes}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-teal-600 dark:text-teal-400">
                            {currency} {formatAmount(r.amount)}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ERPShell>
    </>
  );
}
