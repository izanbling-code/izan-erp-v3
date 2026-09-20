"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Settings = Record<string, any>;

const sections = [
  { key: "general", label: "General" },
  { key: "sales", label: "Sales" },
  { key: "purchases", label: "Purchases" },
  { key: "inventory", label: "Inventory" },
  { key: "accounting", label: "Accounting" },
  { key: "tax", label: "Tax" },
  { key: "numbering", label: "Numbering" },
  { key: "security", label: "Security" },
  { key: "notifications", label: "Notifications" },
  { key: "appearance", label: "Appearance" },
  { key: "dashboard", label: "Dashboard" }, { key: "templates", label: "Document Templates" },
];

export default function SettingsPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("general");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);

      const response = await fetch("/api/settings");
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to load settings.");
      }

      setCompany(data.company);
      setAccounts(data.accounts || []);
      setSettings(data.settings);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to load settings."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateSectionValue(
    section: string,
    field: string,
    value: any
  ) {
    setSettings((current) => {
      if (!current) return current;

      return {
        ...current,
        [section]: {
          ...(current[section] || {}),
          [field]: value,
        },
      };
    });
  }

  async function saveSection(section: string) {
    if (!settings) return;

    try {
      setSaving(true);
      setMessage("");

      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: section,
          value: settings[section] || {},
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to save settings.");
      }

      setSettings(data.settings);
      setMessage("Settings saved successfully.");
      router.refresh(); // 🔥 The Magic Bullet: Forces the whole ERP to update!
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to save settings."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="erp-page">
        <div style={styles.loading}>Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="erp-page">
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>ERP CONFIGURATION</div>
          <h1 style={styles.title}>Settings</h1>
          <p style={styles.subtitle}>
            Configure your company and ERP preferences.
          </p>
        </div>

        {company && (
          <div style={styles.companyBadge}>
            <span style={styles.companyDot} />
            {company.name}
          </div>
        )}
      </div>

      <div style={styles.layout}>
        <aside style={styles.sidebar}>
          <div style={styles.sidebarTitle}>Settings</div>

          {sections.map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => {
                setActiveSection(section.key);
                setMessage("");
              }}
              style={{
                ...styles.navButton,
                ...(activeSection === section.key
                  ? styles.navButtonActive
                  : {}),
              }}
            >
              <span
                style={{
                  ...styles.navIndicator,
                  ...(activeSection === section.key
                    ? styles.navIndicatorActive
                    : {}),
                }}
              />
              {section.label}
            </button>
          ))}
        </aside>

        <main style={styles.content}>
          {activeSection === "general" && (
            <GeneralSettings
              company={company}
              settings={settings}
              updateSectionValue={updateSectionValue}
              saveSection={saveSection}
              saving={saving}
              message={message}
            />
          )}

          {activeSection === "sales" && (
            <SalesSettings
              settings={settings}
              updateSectionValue={updateSectionValue}
              saveSection={saveSection}
              saving={saving}
              message={message}
            />
          )}

          {activeSection === "purchases" && (
            <PurchasesSettings
              settings={settings}
              updateSectionValue={updateSectionValue}
              saveSection={saveSection}
              saving={saving}
              message={message}
            />
          )}
          {activeSection === "inventory" && (
            <InventorySettings
              settings={settings}
              updateSectionValue={updateSectionValue}
              saveSection={saveSection}
              saving={saving}
              message={message}
            />
          )}

          {activeSection === "accounting" && (
            <AccountingSettings
              settings={settings}
              accounts={accounts}
              updateSectionValue={updateSectionValue}
              saveSection={saveSection}
              saving={saving}
              message={message}
            />
          )}

          {activeSection === "tax" && (
            <TaxSettings
              settings={settings}
              accounts={accounts}
              updateSectionValue={updateSectionValue}
              saveSection={saveSection}
              saving={saving}
              message={message}
            />
          )}

          {activeSection === "numbering" && (
            <NumberingSettings
              settings={settings}
              updateSectionValue={updateSectionValue}
              saveSection={saveSection}
              saving={saving}
              message={message}
            />
          )}
          {activeSection === "security" && (
            <SecuritySettings
              settings={settings}
              updateSectionValue={updateSectionValue}
              saveSection={saveSection}
              saving={saving}
              message={message}
            />
          )}
          {activeSection === "notifications" && (
            <NotificationsSettings
              settings={settings}
              updateSectionValue={updateSectionValue}
              saveSection={saveSection}
              saving={saving}
              message={message}
            />
          )}
          {activeSection === "appearance" && (
            <AppearanceSettings
              settings={settings}
              updateSectionValue={updateSectionValue}
              saveSection={saveSection}
              saving={saving}
              message={message}
            />
          )}
          {activeSection === "templates" && ( <TemplatesSettings settings={settings} updateSectionValue={updateSectionValue} saveSection={saveSection} saving={saving} message={message} /> )} {activeSection === "dashboard" && (
            <DashboardSettings
              settings={settings}
              updateSectionValue={updateSectionValue}
              saveSection={saveSection}
              saving={saving}
              message={message}
            />
          )}
          {activeSection !== "general" && activeSection !== "sales" && activeSection !== "purchases" && activeSection !== "inventory" && activeSection !== "accounting" && activeSection !== "tax" && activeSection !== "numbering" && activeSection !== "security" && activeSection !== "notifications" && activeSection !== "appearance" && activeSection !== "dashboard" && activeSection !== "templates" && (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>⚙</div>
                <h2 style={styles.emptyTitle}>
                  {
                    sections.find(
                      (section) =>
                        section.key === activeSection
                    )?.label
                  }{" "}
                  Settings
                </h2>
                <p style={styles.emptyDescription}>
                  This section will be built next.
                </p>
              </div>
            )}
        </main>
      </div>
    </div>
  );
}

function GeneralSettings({
  company,
  settings,
  updateSectionValue,
  saveSection,
  saving,
  message,
}: any) {
  return (
    <>
      <SectionHeader
        title="General Settings"
        description="Basic information and regional preferences for your ERP."
      />

      <Card
        title="Company Information"
        description="Your company profile is used throughout the ERP."
      >
        <div style={styles.formGrid}>
          <Field label="Company Name">
            <input
              style={styles.input}
              value={company?.name || ""}
              disabled
            />
          </Field>

          <Field label="Legal Name">
            <input
              style={styles.input}
              value={company?.legalName || ""}
              disabled
            />
          </Field>

          <Field label="NTN">
            <input
              style={styles.input}
              value={company?.ntn || ""}
              disabled
            />
          </Field>

          <Field label="Country">
            <input
              style={styles.input}
              value={company?.country || "Pakistan"}
              disabled
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Regional Preferences"
        description="Default settings used when creating documents and transactions."
      >
        <div style={styles.formGrid}>
          <Field label="Currency">
            <select
              style={styles.input}
              value={
                settings?.general?.currency ??
                company?.currency ??
                "PKR"
              }
              onChange={(event) =>
                updateSectionValue(
                  "general",
                  "currency",
                  event.target.value
                )
              }
            >
              <option value="PKR">
                PKR — Pakistani Rupee
              </option>
              <option value="USD">
                USD — US Dollar
              </option>
              <option value="AED">
                AED — UAE Dirham
              </option>
              <option value="GBP">
                GBP — British Pound
              </option>
              <option value="EUR">
                EUR — Euro
              </option>
            </select>
          </Field>

          <Field label="Date Format">
            <select
              style={styles.input}
              value={
                settings?.general?.dateFormat ??
                "DD/MM/YYYY"
              }
              onChange={(event) =>
                updateSectionValue(
                  "general",
                  "dateFormat",
                  event.target.value
                )
              }
            >
              <option value="DD/MM/YYYY">
                DD/MM/YYYY
              </option>
              <option value="MM/DD/YYYY">
                MM/DD/YYYY
              </option>
              <option value="YYYY-MM-DD">
                YYYY-MM-DD
              </option>
            </select>
          </Field>

          <Field label="Time Zone">
            <select
              style={styles.input}
              value={
                settings?.general?.timezone ??
                "Asia/Karachi"
              }
              onChange={(event) =>
                updateSectionValue(
                  "general",
                  "timezone",
                  event.target.value
                )
              }
            >
              <option value="Asia/Karachi">
                Asia/Karachi
              </option>
              <option value="Asia/Dubai">
                Asia/Dubai
              </option>
              <option value="UTC">UTC</option>
            </select>
          </Field>

          <Field label="Decimal Places">
            <select
              style={styles.input}
              value={
                settings?.general?.decimalPlaces ?? 2
              }
              onChange={(event) =>
                updateSectionValue(
                  "general",
                  "decimalPlaces",
                  Number(event.target.value)
                )
              }
            >
              <option value={0}>0</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </Field>
        </div>
      </Card>

      <SaveFooter
        message={message}
        saving={saving}
        onSave={() => saveSection("general")}
      />
    </>
  );
}

function SalesSettings({
  settings,
  updateSectionValue,
  saveSection,
  saving,
  message,
}: any) {
  const sales = settings?.sales || {};

  return (
    <>
      <SectionHeader
        title="Sales Settings"
        description="Configure how sales invoices, customers, payments and inventory are handled."
      />

      <Card
        title="Invoice Defaults"
        description="Default behaviour for new sales invoices."
      >
        <div style={styles.formGrid}>
          <Field label="Default Invoice Status">
            <select
              style={styles.input}
              value={sales.defaultInvoiceStatus ?? "DRAFT"}
              onChange={(event) =>
                updateSectionValue(
                  "sales",
                  "defaultInvoiceStatus",
                  event.target.value
                )
              }
            >
              <option value="DRAFT">Draft</option>
              <option value="POSTED">Posted</option>
            </select>
          </Field>

          <Field label="Default Payment Terms">
            <select
              style={styles.input}
              value={sales.defaultPaymentTerms ?? "DUE_ON_RECEIPT"}
              onChange={(event) =>
                updateSectionValue(
                  "sales",
                  "defaultPaymentTerms",
                  event.target.value
                )
              }
            >
              <option value="DUE_ON_RECEIPT">
                Due on Receipt
              </option>
              <option value="NET_7">Net 7</option>
              <option value="NET_15">Net 15</option>
              <option value="NET_30">Net 30</option>
              <option value="NET_60">Net 60</option>
            </select>
          </Field>

          <Field label="Allow Invoice Discounts">
            <Toggle
              checked={sales.allowDiscounts !== false}
              onChange={(value) =>
                updateSectionValue(
                  "sales",
                  "allowDiscounts",
                  value
                )
              }
            />
          </Field>

          <Field label="Allow Invoice Tax">
            <Toggle
              checked={sales.allowTax !== false}
              onChange={(value) =>
                updateSectionValue(
                  "sales",
                  "allowTax",
                  value
                )
              }
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Inventory & Sales"
        description="Control inventory behaviour when sales are posted."
      >
        <div style={styles.formGrid}>
          <Field label="Require Warehouse">
            <Toggle
              checked={sales.requireWarehouse !== false}
              onChange={(value) =>
                updateSectionValue(
                  "sales",
                  "requireWarehouse",
                  value
                )
              }
            />
          </Field>

          <Field label="Require Batch Selection">
            <Toggle
              checked={sales.requireBatch !== false}
              onChange={(value) =>
                updateSectionValue(
                  "sales",
                  "requireBatch",
                  value
                )
              }
            />
          </Field>

          <Field label="Allow Negative Stock">
            <Toggle
              checked={sales.allowNegativeStock === true}
              onChange={(value) =>
                updateSectionValue(
                  "sales",
                  "allowNegativeStock",
                  value
                )
              }
            />
          </Field>

          <Field label="Update Inventory On">
            <select
              style={styles.input}
              value={sales.inventoryUpdateTiming ?? "POST"}
              onChange={(event) =>
                updateSectionValue(
                  "sales",
                  "inventoryUpdateTiming",
                  event.target.value
                )
              }
            >
              <option value="POST">
                Invoice Posting
              </option>
              <option value="SAVE">
                Invoice Save
              </option>
            </select>
          </Field>
        </div>
      </Card>

      <Card
        title="Customer & Payment Defaults"
        description="Default customer and payment behaviour."
      >
        <div style={styles.formGrid}>
          <Field label="Allow Cash Sales">
            <Toggle
              checked={sales.allowCashSales !== false}
              onChange={(value) =>
                updateSectionValue(
                  "sales",
                  "allowCashSales",
                  value
                )
              }
            />
          </Field>

          <Field label="Require Customer">
            <Toggle
              checked={sales.requireCustomer !== false}
              onChange={(value) =>
                updateSectionValue(
                  "sales",
                  "requireCustomer",
                  value
                )
              }
            />
          </Field>

          <Field label="Allow Partial Payments">
            <Toggle
              checked={sales.allowPartialPayments !== false}
              onChange={(value) =>
                updateSectionValue(
                  "sales",
                  "allowPartialPayments",
                  value
                )
              }
            />
          </Field>

          <Field label="Auto-Calculate Balance">
            <Toggle
              checked={sales.autoCalculateBalance !== false}
              onChange={(value) =>
                updateSectionValue(
                  "sales",
                  "autoCalculateBalance",
                  value
                )
              }
            />
          </Field>
        </div>
      </Card>

      <SaveFooter
        message={message}
        saving={saving}
        onSave={() => saveSection("sales")}
      />
    </>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div style={styles.sectionHeader}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <p style={styles.sectionDescription}>
        {description}
      </p>
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <h3 style={styles.cardTitle}>{title}</h3>
        <p style={styles.cardDescription}>
          {description}
        </p>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.field}>
      <div>
        <label style={styles.label}>{label}</label>
        {description && (
          <div style={styles.fieldDescription}>{description}</div>
        )}
      </div>
      {children}
    </div>
  );
}
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        ...styles.toggle,
        ...(checked ? styles.toggleOn : styles.toggleOff),
      }}
      aria-pressed={checked}
    >
      <span
        style={{
          ...styles.toggleKnob,
          ...(checked
            ? styles.toggleKnobOn
            : styles.toggleKnobOff),
        }}
      />
      <span style={styles.toggleText}>
        {checked ? "Enabled" : "Disabled"}
      </span>
    </button>
  );
}

function SaveFooter({
  message,
  saving,
  onSave,
}: {
  message: string;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div style={styles.footer}>
      <div style={styles.message}>{message}</div>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        style={{
          ...styles.saveButton,
          ...(saving
            ? styles.saveButtonDisabled
            : {}),
        }}
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}


function PurchasesSettings({
  settings,
  updateSectionValue,
  saveSection,
  saving,
  message,
}: {
  settings: any;
  updateSectionValue: (section: string, field: string, value: any) => void;
  saveSection: (section: string) => Promise<void> | void;
  saving: boolean;
  message: string;
}) {
  const purchases = settings?.purchases || {};

  const update = (field: string, value: any) => {
    updateSectionValue("purchases", field, value);
  };

  return (
    <div style={styles.sectionStack}>
      <SectionHeader
        title="Purchases Settings"
        description="Configure purchase bills, suppliers, payments and inventory behaviour."
      />

      <Card
        title="Purchase Bills"
        description="Default behaviour for new purchase bills."
      >
        <Field
          label="Default Bill Status"
          description="Status assigned when a new purchase bill is created."
        >
          <select
            style={styles.select}
            value={purchases.defaultBillStatus ?? "DRAFT"}
            onChange={(e) =>
              update("defaultBillStatus", e.target.value)
            }
          >
            <option value="DRAFT">Draft</option>
            <option value="POSTED">Posted</option>
          </select>
        </Field>

        <Field
          label="Default Payment Terms"
          description="Default payment terms for new supplier bills."
        >
          <select
            style={styles.select}
            value={purchases.defaultPaymentTerms ?? "DUE_ON_RECEIPT"}
            onChange={(e) =>
              update("defaultPaymentTerms", e.target.value)
            }
          >
            <option value="DUE_ON_RECEIPT">Due on Receipt</option>
            <option value="NET_7">Net 7 Days</option>
            <option value="NET_15">Net 15 Days</option>
            <option value="NET_30">Net 30 Days</option>
            <option value="NET_60">Net 60 Days</option>
          </select>
        </Field>

        <Field
          label="Allow Discounts"
          description="Allow discounts to be entered on purchase bills."
        >
          <Toggle
            checked={purchases.allowDiscounts !== false}
            onChange={(value) => update("allowDiscounts", value)}
          />
        </Field>

        <Field
          label="Allow Tax"
          description="Allow tax amounts to be entered on purchase bills."
        >
          <Toggle
            checked={purchases.allowTax !== false}
            onChange={(value) => update("allowTax", value)}
          />
        </Field>
      </Card>

      <Card
        title="Inventory & Purchases"
        description="Control inventory behaviour when purchase bills are posted."
      >
        <Field
          label="Require Warehouse"
          description="Require a warehouse when adding products to purchase bills."
        >
          <Toggle
            checked={purchases.requireWarehouse !== false}
            onChange={(value) => update("requireWarehouse", value)}
          />
        </Field>

        <Field
          label="Require Batch"
          description="Require a batch for inventory products purchased."
        >
          <Toggle
            checked={purchases.requireBatch !== false}
            onChange={(value) => update("requireBatch", value)}
          />
        </Field>

        <Field
          label="Inventory Update Timing"
          description="Choose when purchased inventory should be added to stock."
        >
          <select
            style={styles.select}
            value={purchases.inventoryUpdateTiming ?? "POST"}
            onChange={(e) =>
              update("inventoryUpdateTiming", e.target.value)
            }
          >
            <option value="POST">When Bill Is Posted</option>
            <option value="SAVE">When Bill Is Saved</option>
          </select>
        </Field>

        <Field
          label="Allow Purchase Returns"
          description="Allow purchase transactions to be returned to suppliers."
        >
          <Toggle
            checked={purchases.allowReturns !== false}
            onChange={(value) => update("allowReturns", value)}
          />
        </Field>
      </Card>

      <Card
        title="Supplier & Payment"
        description="Control supplier and payment behaviour for purchases."
      >
        <Field
          label="Require Supplier"
          description="Require a supplier when creating a purchase bill."
        >
          <Toggle
            checked={purchases.requireSupplier !== false}
            onChange={(value) => update("requireSupplier", value)}
          />
        </Field>

        <Field
          label="Allow Partial Payments"
          description="Allow supplier bills to be partially paid."
        >
          <Toggle
            checked={purchases.allowPartialPayments !== false}
            onChange={(value) =>
              update("allowPartialPayments", value)
            }
          />
        </Field>

        <Field
          label="Auto Calculate Balance"
          description="Automatically calculate the outstanding supplier balance."
        >
          <Toggle
            checked={purchases.autoCalculateBalance !== false}
            onChange={(value) =>
              update("autoCalculateBalance", value)
            }
          />
        </Field>
      </Card>

      <SaveFooter
        message={message || "Configure your default purchase and supplier behaviour here."}
        saving={saving}
        onSave={() => saveSection("purchases")}
      />
    </div>
  );
}function TaxSettings({
  settings,
  accounts,
  updateSectionValue,
  saveSection,
  saving,
  message,
}: {
  settings: any;
  accounts: any[];
  updateSectionValue: (
    section: string,
    field: string,
    value: any
  ) => void;
  saveSection: (section: string) => Promise<void> | void;
  saving: boolean;
  message: string;
}) {
  const tax = settings?.tax || {};

  const update = (key: string, value: any) => {
    updateSectionValue("tax", key, value);
  };

  const accountOptions = [
    {
      value: "",
      label: "Select account",
    },
    ...accounts.map((account) => ({
      value: account.id,
      label: `${account.code} — ${account.name}`,
    })),
  ];

  return (
    <div style={styles.sectionStack}>
      <SectionHeader
        title="Tax Settings"
        description="Configure tax calculation, default rates and tax accounting behaviour."
      />

      <Card
        title="Tax Configuration"
        description="Control whether tax is enabled and how prices are treated."
      >
        <div style={styles.formStack}>
          <Field
            label="Enable Tax"
            description="Enable tax calculations throughout sales and purchase transactions."
          >
            <Toggle
              checked={tax.enabled !== false}
              onChange={(value) => update("enabled", value)}
            />
          </Field>

          <Field
            label="Prices Include Tax"
            description="Treat entered sales prices as tax-inclusive amounts."
          >
            <Toggle
              checked={tax.pricesIncludeTax === true}
              onChange={(value) =>
                update("pricesIncludeTax", value)
              }
            />
          </Field>

          <Field
            label="Allow Tax Override"
            description="Allow users to change the calculated tax on individual transactions."
          >
            <Toggle
              checked={tax.allowOverride !== false}
              onChange={(value) =>
                update("allowOverride", value)
              }
            />
          </Field>

          <Field
            label="Allow Tax-Exempt Transactions"
            description="Allow invoices and bills to be recorded without tax."
          >
            <Toggle
              checked={tax.allowExempt === true}
              onChange={(value) =>
                update("allowExempt", value)
              }
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Default Tax Rates"
        description="Set the default tax percentages used when a specific tax rate has not been selected."
      >
        <div style={styles.formGrid}>
          <Field
            label="Default Sales Tax Rate (%)"
            description="Default tax rate applied to sales."
          >
            <input
              type="number"
              min="0"
              step="0.01"
              style={styles.input}
              value={tax.defaultSalesRate ?? ""}
              onChange={(e) =>
                update(
                  "defaultSalesRate",
                  e.target.value === ""
                    ? null
                    : Number(e.target.value)
                )
              }
              placeholder="0.00"
            />
          </Field>

          <Field
            label="Default Purchase Tax Rate (%)"
            description="Default tax rate applied to purchases."
          >
            <input
              type="number"
              min="0"
              step="0.01"
              style={styles.input}
              value={tax.defaultPurchaseRate ?? ""}
              onChange={(e) =>
                update(
                  "defaultPurchaseRate",
                  e.target.value === ""
                    ? null
                    : Number(e.target.value)
                )
              }
              placeholder="0.00"
            />
          </Field>

          <Field
            label="Default Tax Code"
            description="Optional code used to identify the default tax configuration."
          >
            <input
              style={styles.input}
              value={tax.defaultTaxCode ?? ""}
              onChange={(e) =>
                update("defaultTaxCode", e.target.value)
              }
              placeholder="e.g. GST"
            />
          </Field>

          <Field
            label="Tax Registration Number"
            description="Your company's tax registration or GST number."
          >
            <input
              style={styles.input}
              value={tax.registrationNumber ?? ""}
              onChange={(e) =>
                update(
                  "registrationNumber",
                  e.target.value
                )
              }
              placeholder="Enter registration number"
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Tax Accounts"
        description="Select the ledger accounts used to record tax balances."
      >
        <div style={styles.formGrid}>
          <Field
            label="Tax Payable Account"
            description="Liability account used for tax collected from customers."
          >
            <select
              style={styles.input}
              value={tax.taxPayableAccountId ?? ""}
              onChange={(e) =>
                update(
                  "taxPayableAccountId",
                  e.target.value || null
                )
              }
            >
              {accountOptions.map((account) => (
                <option key={account.value} value={account.value}>
                  {account.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Tax Receivable Account"
            description="Asset account used for recoverable tax paid to suppliers."
          >
            <select
              style={styles.input}
              value={tax.taxReceivableAccountId ?? ""}
              onChange={(e) =>
                update(
                  "taxReceivableAccountId",
                  e.target.value || null
                )
              }
            >
              {accountOptions.map((account) => (
                <option key={account.value} value={account.value}>
                  {account.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Default Tax Expense Account"
            description="Optional expense account for non-recoverable tax."
          >
            <select
              style={styles.input}
              value={tax.taxExpenseAccountId ?? ""}
              onChange={(e) =>
                update(
                  "taxExpenseAccountId",
                  e.target.value || null
                )
              }
            >
              {accountOptions.map((account) => (
                <option key={account.value} value={account.value}>
                  {account.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <Card
        title="Tax Calculation"
        description="Control how tax is calculated and rounded on transactions."
      >
        <div style={styles.formStack}>
          <Field
            label="Apply Tax Automatically"
            description="Automatically apply the configured tax rate to eligible transactions."
          >
            <Toggle
              checked={tax.autoApply !== false}
              onChange={(value) =>
                update("autoApply", value)
              }
            />
          </Field>

          <Field
            label="Calculate Tax After Discount"
            description="Calculate tax using the amount remaining after discounts."
          >
            <Toggle
              checked={tax.calculateAfterDiscount !== false}
              onChange={(value) =>
                update(
                  "calculateAfterDiscount",
                  value
                )
              }
            />
          </Field>

          <Field
            label="Calculate Tax Per Line"
            description="Calculate and round tax separately for each invoice or bill line."
          >
            <Toggle
              checked={tax.calculatePerLine === true}
              onChange={(value) =>
                update("calculatePerLine", value)
              }
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Tax Rounding"
        description="Choose how calculated tax amounts should be rounded."
      >
        <div style={styles.formGrid}>
          <Field
            label="Rounding Precision"
            description="Number of decimal places used for tax amounts."
          >
            <select
              style={styles.input}
              value={tax.roundingPrecision ?? "2"}
              onChange={(e) =>
                update(
                  "roundingPrecision",
                  Number(e.target.value)
                )
              }
            >
              <option value="0">0 decimal places</option>
              <option value="1">1 decimal place</option>
              <option value="2">2 decimal places</option>
              <option value="3">3 decimal places</option>
            </select>
          </Field>

          <Field
            label="Rounding Method"
            description="Method used when rounding calculated tax."
          >
            <select
              style={styles.input}
              value={tax.roundingMethod ?? "HALF_UP"}
              onChange={(e) =>
                update(
                  "roundingMethod",
                  e.target.value
                )
              }
            >
              <option value="HALF_UP">Half Up</option>
              <option value="HALF_DOWN">Half Down</option>
              <option value="UP">Always Up</option>
              <option value="DOWN">Always Down</option>
            </select>
          </Field>
        </div>
      </Card>

      <SaveFooter
        message={message}
        saving={saving}
        onSave={() => saveSection("tax")}
      />
    </div>
  );
}
function NumberingSettings({
  settings,
  updateSectionValue,
  saveSection,
  saving,
  message,
}: {
  settings: any;
  updateSectionValue: (
    section: string,
    field: string,
    value: any
  ) => void;
  saveSection: (section: string) => Promise<void> | void;
  saving: boolean;
  message: string;
}) {
  const numbering = settings?.numbering || {};

  const update = (key: string, value: any) => {
    updateSectionValue("numbering", key, value);
  };

  const documents = [
    {
      key: "salesInvoice",
      label: "Sales Invoice",
      description: "Numbering used for customer sales invoices.",
      defaultPrefix: "INV-",
    },
    {
      key: "purchaseBill",
      label: "Purchase Bill",
      description: "Numbering used for supplier purchase bills.",
      defaultPrefix: "BILL-",
    },
    {
      key: "customerPayment",
      label: "Customer Payment",
      description: "Numbering used for payments received from customers.",
      defaultPrefix: "REC-",
    },
    {
      key: "supplierPayment",
      label: "Supplier Payment",
      description: "Numbering used for payments made to suppliers.",
      defaultPrefix: "PAY-",
    },
    {
      key: "journalEntry",
      label: "Journal Entry",
      description: "Numbering used for manual journal entries.",
      defaultPrefix: "JE-",
    },
    {
      key: "creditNote",
      label: "Credit Note",
      description: "Numbering used for customer credit notes.",
      defaultPrefix: "CN-",
    },
    {
      key: "debitNote",
      label: "Debit Note",
      description: "Numbering used for supplier debit notes.",
      defaultPrefix: "DN-",
    },
    {
      key: "stockAdjustment",
      label: "Stock Adjustment",
      description: "Numbering used for inventory adjustments.",
      defaultPrefix: "ADJ-",
    },
  ];

  function getDocument(key: string) {
    return numbering[key] || {};
  }

  function updateDocument(
    key: string,
    field: string,
    value: any
  ) {
    update(key, {
      ...getDocument(key),
      [field]: value,
    });
  }

  function preview(
    key: string,
    defaultPrefix: string
  ) {
    const document = getDocument(key);

    const prefix =
      document.prefix !== undefined
        ? document.prefix
        : defaultPrefix;

    const nextNumber = Number(
      document.nextNumber ?? 1
    );

    const padding = Number(
      document.padding ?? 5
    );

    return `${prefix}${String(nextNumber).padStart(
      padding,
      "0"
    )}`;
  }

  return (
    <div style={styles.sectionStack}>
      <SectionHeader
        title="Numbering Settings"
        description="Configure automatic numbering for sales, purchases, payments, journals and inventory documents."
      />

      <Card
        title="General Numbering"
        description="Control the default behaviour used when generating document numbers."
      >
        <div style={styles.formStack}>
          <Field
            label="Automatic Numbering"
            description="Automatically generate the next document number when a transaction is created."
          >
            <Toggle
              checked={numbering.enabled !== false}
              onChange={(value) =>
                update("enabled", value)
              }
            />
          </Field>

          <Field
            label="Reset Numbering Every Year"
            description="Start document numbering again from the configured starting number each year."
          >
            <Toggle
              checked={numbering.resetYearly === true}
              onChange={(value) =>
                update("resetYearly", value)
              }
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Document Number Formats"
        description="Configure prefixes, starting numbers and padding for each document type."
      >
        <div style={styles.sectionStack}>
          {documents.map((document) => {
            const value = getDocument(document.key);

            return (
              <div
                key={document.key}
                style={styles.numberingCard}
              >
                <div style={styles.numberingHeader}>
                  <div>
                    <h3 style={styles.numberingTitle}>
                      {document.label}
                    </h3>

                    <p style={styles.numberingDescription}>
                      {document.description}
                    </p>
                  </div>

                  <div style={styles.numberingPreview}>
                    <span style={styles.numberingPreviewLabel}>
                      Preview
                    </span>

                    <strong>
                      {preview(
                        document.key,
                        document.defaultPrefix
                      )}
                    </strong>
                  </div>
                </div>

                <div style={styles.formGrid}>
                  <Field label="Prefix">
                    <input
                      style={styles.input}
                      value={
                        value.prefix ??
                        document.defaultPrefix
                      }
                      onChange={(e) =>
                        updateDocument(
                          document.key,
                          "prefix",
                          e.target.value
                        )
                      }
                      placeholder={document.defaultPrefix}
                    />
                  </Field>

                  <Field label="Next Number">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      style={styles.input}
                      value={value.nextNumber ?? 1}
                      onChange={(e) =>
                        updateDocument(
                          document.key,
                          "nextNumber",
                          Math.max(
                            1,
                            Number(e.target.value) || 1
                          )
                        )
                      }
                    />
                  </Field>

                  <Field label="Number Padding">
                    <select
                      style={styles.input}
                      value={value.padding ?? 5}
                      onChange={(e) =>
                        updateDocument(
                          document.key,
                          "padding",
                          Number(e.target.value)
                        )
                      }
                    >
                      <option value="1">1 digit</option>
                      <option value="2">2 digits</option>
                      <option value="3">3 digits</option>
                      <option value="4">4 digits</option>
                      <option value="5">5 digits</option>
                      <option value="6">6 digits</option>
                      <option value="7">7 digits</option>
                      <option value="8">8 digits</option>
                    </select>
                  </Field>

                  <Field label="Use Year in Number">
                    <Toggle
                      checked={value.includeYear === true}
                      onChange={(checked) =>
                        updateDocument(
                          document.key,
                          "includeYear",
                          checked
                        )
                      }
                    />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        title="Numbering Examples"
        description="Examples based on your current numbering configuration."
      >
        <div style={styles.numberingExamples}>
          {documents.map((document) => (
            <div
              key={document.key}
              style={styles.exampleRow}
            >
              <span>{document.label}</span>

              <strong>
                {preview(
                  document.key,
                  document.defaultPrefix
                )}
              </strong>
            </div>
          ))}
        </div>
      </Card>

      <SaveFooter
        message={message}
        saving={saving}
        onSave={() => saveSection("numbering")}
      />
    </div>
  );
}
function SecuritySettings({
  settings,
  updateSectionValue,
  saveSection,
  saving,
  message,
}: {
  settings: any;
  updateSectionValue: (
    section: string,
    field: string,
    value: any
  ) => void;
  saveSection: (section: string) => Promise<void> | void;
  saving: boolean;
  message: string;
}) {
  const security = settings?.security || {};

  const update = (key: string, value: any) => {
    updateSectionValue("security", key, value);
  };

  return (
    <div style={styles.sectionStack}>
      <SectionHeader
        title="Security Settings"
        description="Configure security, session and access-control preferences for your ERP."
      />

      <Card
        title="Login & Session"
        description="Control session behaviour for users accessing the ERP."
      >
        <div style={styles.formStack}>
          <Field
            label="Require Login"
            description="Require authenticated users before accessing ERP modules."
          >
            <Toggle
              checked={security.requireLogin !== false}
              onChange={(value) =>
                update("requireLogin", value)
              }
            />
          </Field>

          <Field
            label="Remember Login"
            description="Allow users to remain signed in between browser sessions."
          >
            <Toggle
              checked={security.rememberLogin !== false}
              onChange={(value) =>
                update("rememberLogin", value)
              }
            />
          </Field>

          <Field
            label="Automatic Logout"
            description="Automatically end inactive sessions after the configured timeout."
          >
            <Toggle
              checked={security.autoLogout !== false}
              onChange={(value) =>
                update("autoLogout", value)
              }
            />
          </Field>

          <Field
            label="Session Timeout"
            description="Number of minutes before an inactive user session expires."
          >
            <select
              style={styles.input}
              value={security.sessionTimeout ?? 30}
              onChange={(e) =>
                update(
                  "sessionTimeout",
                  Number(e.target.value)
                )
              }
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="120">2 hours</option>
              <option value="240">4 hours</option>
              <option value="480">8 hours</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card
        title="Password Policy"
        description="Define the minimum password requirements for ERP users."
      >
        <div style={styles.formGrid}>
          <Field
            label="Minimum Password Length"
            description="Minimum number of characters required for a password."
          >
            <select
              style={styles.input}
              value={security.minimumPasswordLength ?? 8}
              onChange={(e) =>
                update(
                  "minimumPasswordLength",
                  Number(e.target.value)
                )
              }
            >
              <option value="6">6 characters</option>
              <option value="8">8 characters</option>
              <option value="10">10 characters</option>
              <option value="12">12 characters</option>
              <option value="14">14 characters</option>
              <option value="16">16 characters</option>
            </select>
          </Field>

          <Field
            label="Password Expiry"
            description="Require users to change their passwords periodically."
          >
            <Toggle
              checked={security.passwordExpiry === true}
              onChange={(value) =>
                update("passwordExpiry", value)
              }
            />
          </Field>

          <Field
            label="Password Expiry Period"
            description="Number of days before a password expires."
          >
            <select
              style={styles.input}
              value={security.passwordExpiryDays ?? 90}
              onChange={(e) =>
                update(
                  "passwordExpiryDays",
                  Number(e.target.value)
                )
              }
            >
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365">365 days</option>
            </select>
          </Field>
        </div>

        <div style={styles.formStack}>
          <Field
            label="Require Uppercase"
            description="Require at least one uppercase letter."
          >
            <Toggle
              checked={security.requireUppercase !== false}
              onChange={(value) =>
                update("requireUppercase", value)
              }
            />
          </Field>

          <Field
            label="Require Lowercase"
            description="Require at least one lowercase letter."
          >
            <Toggle
              checked={security.requireLowercase !== false}
              onChange={(value) =>
                update("requireLowercase", value)
              }
            />
          </Field>

          <Field
            label="Require Number"
            description="Require at least one numeric character."
          >
            <Toggle
              checked={security.requireNumber !== false}
              onChange={(value) =>
                update("requireNumber", value)
              }
            />
          </Field>

          <Field
            label="Require Special Character"
            description="Require at least one special character such as !, @ or #."
          >
            <Toggle
              checked={security.requireSpecialCharacter === true}
              onChange={(value) =>
                update(
                  "requireSpecialCharacter",
                  value
                )
              }
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Access Control"
        description="Control how users and sessions are allowed to operate within the ERP."
      >
        <div style={styles.formStack}>
          <Field
            label="Allow Multiple Sessions"
            description="Allow the same user to remain signed in from multiple devices."
          >
            <Toggle
              checked={security.allowMultipleSessions !== false}
              onChange={(value) =>
                update(
                  "allowMultipleSessions",
                  value
                )
              }
            />
          </Field>

          <Field
            label="Require Confirmation for Sensitive Actions"
            description="Ask users to confirm potentially destructive or sensitive operations."
          >
            <Toggle
              checked={
                security.confirmSensitiveActions !== false
              }
              onChange={(value) =>
                update(
                  "confirmSensitiveActions",
                  value
                )
              }
            />
          </Field>

          <Field
            label="Restrict Inactive Users"
            description="Prevent users marked inactive from accessing the ERP."
          >
            <Toggle
              checked={security.restrictInactiveUsers !== false}
              onChange={(value) =>
                update(
                  "restrictInactiveUsers",
                  value
                )
              }
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Audit & Security Logging"
        description="Configure which security-related activities should be recorded."
      >
        <div style={styles.formStack}>
          <Field
            label="Enable Audit Logging"
            description="Record important ERP actions and configuration changes."
          >
            <Toggle
              checked={security.auditLogging !== false}
              onChange={(value) =>
                update("auditLogging", value)
              }
            />
          </Field>

          <Field
            label="Log Login Attempts"
            description="Record successful and unsuccessful login attempts."
          >
            <Toggle
              checked={security.logLoginAttempts !== false}
              onChange={(value) =>
                update(
                  "logLoginAttempts",
                  value
                )
              }
            />
          </Field>

          <Field
            label="Log Configuration Changes"
            description="Record changes made to ERP settings."
          >
            <Toggle
              checked={security.logConfigurationChanges !== false}
              onChange={(value) =>
                update(
                  "logConfigurationChanges",
                  value
                )
              }
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Data Protection"
        description="Additional safeguards for important ERP data and operations."
      >
        <div style={styles.formStack}>
          <Field
            label="Confirm Before Deletion"
            description="Require confirmation before deleting records."
          >
            <Toggle
              checked={security.confirmBeforeDelete !== false}
              onChange={(value) =>
                update(
                  "confirmBeforeDelete",
                  value
                )
              }
            />
          </Field>

          <Field
            label="Protect System Records"
            description="Prevent users from deleting or modifying system-generated records."
          >
            <Toggle
              checked={security.protectSystemRecords !== false}
              onChange={(value) =>
                update(
                  "protectSystemRecords",
                  value
                )
              }
            />
          </Field>
        </div>
      </Card>

      <SaveFooter
        message={message}
        saving={saving}
        onSave={() => saveSection("security")}
      />
    </div>
  );
}
function NotificationsSettings({
  settings,
  updateSectionValue,
  saveSection,
  saving,
  message,
}: {
  settings: any;
  updateSectionValue: (
    section: string,
    field: string,
    value: any
  ) => void;
  saveSection: (section: string) => Promise<void> | void;
  saving: boolean;
  message: string;
}) {
  const notifications = settings?.notifications || {};

  const update = (key: string, value: any) => {
    updateSectionValue("notifications", key, value);
  };

  return (
    <div style={styles.sectionStack}>
      <SectionHeader
        title="Notifications Settings"
        description="Configure alerts and notifications generated by your ERP."
      />

      <Card
        title="Notification Preferences"
        description="Control the notification channels and general notification behaviour."
      >
        <div style={styles.formStack}>
          <Field
            label="Enable Notifications"
            description="Enable notifications throughout the ERP."
          >
            <Toggle
              checked={notifications.enabled !== false}
              onChange={(value) =>
                update("enabled", value)
              }
            />
          </Field>

          <Field
            label="In-App Notifications"
            description="Show notifications inside the ERP application."
          >
            <Toggle
              checked={notifications.inApp !== false}
              onChange={(value) =>
                update("inApp", value)
              }
            />
          </Field>

          <Field
            label="Email Notifications"
            description="Allow the ERP to send notification emails when supported."
          >
            <Toggle
              checked={notifications.email === true}
              onChange={(value) =>
                update("email", value)
              }
            />
          </Field>

          <Field
            label="Sound Notifications"
            description="Play a notification sound for important in-app alerts."
          >
            <Toggle
              checked={notifications.sound === true}
              onChange={(value) =>
                update("sound", value)
              }
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Sales Notifications"
        description="Choose which sales-related events should generate notifications."
      >
        <div style={styles.formStack}>
          <Field
            label="New Sales Invoice"
            description="Notify when a new sales invoice is created."
          >
            <Toggle
              checked={notifications.salesInvoice !== false}
              onChange={(value) =>
                update("salesInvoice", value)
              }
            />
          </Field>

          <Field
            label="Payment Received"
            description="Notify when a customer payment is recorded."
          >
            <Toggle
              checked={notifications.paymentReceived !== false}
              onChange={(value) =>
                update("paymentReceived", value)
              }
            />
          </Field>

          <Field
            label="Outstanding Invoice"
            description="Notify when an invoice remains unpaid or becomes overdue."
          >
            <Toggle
              checked={notifications.outstandingInvoice === true}
              onChange={(value) =>
                update("outstandingInvoice", value)
              }
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Purchase Notifications"
        description="Choose which purchase-related events should generate notifications."
      >
        <div style={styles.formStack}>
          <Field
            label="New Purchase Bill"
            description="Notify when a new purchase bill is created."
          >
            <Toggle
              checked={notifications.purchaseBill !== false}
              onChange={(value) =>
                update("purchaseBill", value)
              }
            />
          </Field>

          <Field
            label="Supplier Payment"
            description="Notify when a supplier payment is recorded."
          >
            <Toggle
              checked={notifications.supplierPayment !== false}
              onChange={(value) =>
                update("supplierPayment", value)
              }
            />
          </Field>

          <Field
            label="Overdue Supplier Balance"
            description="Notify when a supplier balance becomes overdue."
          >
            <Toggle
              checked={notifications.overdueSupplierBalance === true}
              onChange={(value) =>
                update("overdueSupplierBalance", value)
              }
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Inventory Alerts"
        description="Configure alerts related to inventory and stock levels."
      >
        <div style={styles.formStack}>
          <Field
            label="Low Stock Alerts"
            description="Notify when an inventory item reaches or falls below its low-stock level."
          >
            <Toggle
              checked={notifications.lowStock !== false}
              onChange={(value) =>
                update("lowStock", value)
              }
            />
          </Field>

          <Field
            label="Out of Stock Alerts"
            description="Notify when an item reaches zero available stock."
          >
            <Toggle
              checked={notifications.outOfStock !== false}
              onChange={(value) =>
                update("outOfStock", value)
              }
            />
          </Field>

          <Field
            label="Stock Adjustment Alerts"
            description="Notify when inventory quantities are manually adjusted."
          >
            <Toggle
              checked={notifications.stockAdjustment === true}
              onChange={(value) =>
                update("stockAdjustment", value)
              }
            />
          </Field>

          <Field
            label="Default Low Stock Threshold"
            description="Default quantity at which a low-stock notification should be triggered."
          >
            <input
              type="number"
              min="0"
              step="1"
              style={styles.input}
              value={notifications.lowStockThreshold ?? 5}
              onChange={(e) =>
                update(
                  "lowStockThreshold",
                  Math.max(
                    0,
                    Number(e.target.value) || 0
                  )
                )
              }
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Customer & Supplier Notifications"
        description="Configure notifications for important customer and supplier events."
      >
        <div style={styles.formStack}>
          <Field
            label="New Customer"
            description="Notify when a new customer is created."
          >
            <Toggle
              checked={notifications.newCustomer === true}
              onChange={(value) =>
                update("newCustomer", value)
              }
            />
          </Field>

          <Field
            label="New Supplier"
            description="Notify when a new supplier is created."
          >
            <Toggle
              checked={notifications.newSupplier === true}
              onChange={(value) =>
                update("newSupplier", value)
              }
            />
          </Field>

          <Field
            label="Customer Balance Alert"
            description="Notify when a customer account requires attention."
          >
            <Toggle
              checked={notifications.customerBalanceAlert === true}
              onChange={(value) =>
                update("customerBalanceAlert", value)
              }
            />
          </Field>

          <Field
            label="Supplier Balance Alert"
            description="Notify when a supplier account requires attention."
          >
            <Toggle
              checked={notifications.supplierBalanceAlert === true}
              onChange={(value) =>
                update("supplierBalanceAlert", value)
              }
            />
          </Field>
        </div>
      </Card>

      <Card
        title="System Notifications"
        description="Important notifications about the ERP itself."
      >
        <div style={styles.formStack}>
          <Field
            label="System Alerts"
            description="Show important system-level alerts and warnings."
          >
            <Toggle
              checked={notifications.systemAlerts !== false}
              onChange={(value) =>
                update("systemAlerts", value)
              }
            />
          </Field>

          <Field
            label="Configuration Changes"
            description="Notify when important ERP configuration settings are changed."
          >
            <Toggle
              checked={notifications.configurationChanges === true}
              onChange={(value) =>
                update("configurationChanges", value)
              }
            />
          </Field>

          <Field
            label="Backup Notifications"
            description="Notify when backup-related events are available."
          >
            <Toggle
              checked={notifications.backupNotifications === true}
              onChange={(value) =>
                update("backupNotifications", value)
              }
            />
          </Field>
        </div>
      </Card>

      <SaveFooter
        message={message}
        saving={saving}
        onSave={() => saveSection("notifications")}
      />
    </div>
  );
}
function AppearanceSettings({
  settings,
  updateSectionValue,
  saveSection,
  saving,
  message,
}: {
  settings: any;
  updateSectionValue: (
    section: string,
    field: string,
    value: any
  ) => void;
  saveSection: (section: string) => Promise<void> | void;
  saving: boolean;
  message: string;
}) {
  const appearance = settings?.appearance || {};

  const update = (key: string, value: any) => {
    updateSectionValue("appearance", key, value);
  };

  return (
    <div style={styles.sectionStack}>
      <SectionHeader
        title="Appearance Settings"
        description="Configure how the ERP interface and information are displayed."
      />

      <Card
        title="Interface Theme"
        description="Choose the preferred visual theme for the ERP."
      >
        <div style={styles.formStack}>
          <Field
            label="Theme"
            description="Select the interface theme you prefer."
          >
            <select
              style={styles.input}
              value={appearance.theme ?? "LIGHT"}
              onChange={(e) =>
                update("theme", e.target.value)
              }
            >
              <option value="LIGHT">Light</option>
              <option value="DARK">Dark</option>
              <option value="SYSTEM">Use System Preference</option>
            </select>
          </Field>

          <Field
            label="Use System Theme"
            description="Automatically follow your operating system's light or dark preference."
          >
            <Toggle
              checked={appearance.useSystemTheme === true}
              onChange={(value) =>
                update("useSystemTheme", value)
              }
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Layout & Density"
        description="Control the amount of information displayed on each screen."
      >
        <div style={styles.formGrid}>
          <Field
            label="Interface Density"
            description="Choose how compact the ERP interface should be."
          >
            <select
              style={styles.input}
              value={appearance.density ?? "COMFORTABLE"}
              onChange={(e) =>
                update("density", e.target.value)
              }
            >
              <option value="COMPACT">Compact</option>
              <option value="COMFORTABLE">Comfortable</option>
              <option value="SPACIOUS">Spacious</option>
            </select>
          </Field>

          <Field
            label="Table Row Density"
            description="Control the vertical spacing of rows in ERP tables."
          >
            <select
              style={styles.input}
              value={appearance.tableDensity ?? "COMFORTABLE"}
              onChange={(e) =>
                update("tableDensity", e.target.value)
              }
            >
              <option value="COMPACT">Compact</option>
              <option value="COMFORTABLE">Comfortable</option>
              <option value="SPACIOUS">Spacious</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card
        title="Sidebar"
        description="Configure how the ERP navigation sidebar behaves."
      >
        <div style={styles.formStack}>
          <Field
            label="Show Sidebar Labels"
            description="Display text labels alongside sidebar navigation icons."
          >
            <Toggle
              checked={appearance.showSidebarLabels !== false}
              onChange={(value) =>
                update("showSidebarLabels", value)
              }
            />
          </Field>

          <Field
            label="Remember Sidebar State"
            description="Remember whether the sidebar was expanded or collapsed."
          >
            <Toggle
              checked={appearance.rememberSidebarState !== false}
              onChange={(value) =>
                update(
                  "rememberSidebarState",
                  value
                )
              }
            />
          </Field>

          <Field
            label="Sidebar Behaviour"
            description="Choose how the sidebar behaves when navigating through the ERP."
          >
            <select
              style={styles.input}
              value={appearance.sidebarBehaviour ?? "FIXED"}
              onChange={(e) =>
                update(
                  "sidebarBehaviour",
                  e.target.value
                )
              }
            >
              <option value="FIXED">Fixed</option>
              <option value="COLLAPSIBLE">Collapsible</option>
              <option value="AUTO">Automatic</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card
        title="Display Preferences"
        description="Choose how dates, numbers and general information are displayed."
      >
        <div style={styles.formGrid}>
          <Field
            label="Date Format"
            description="Choose the date format used throughout the ERP."
          >
            <select
              style={styles.input}
              value={appearance.dateFormat ?? "DD/MM/YYYY"}
              onChange={(e) =>
                update("dateFormat", e.target.value)
              }
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="DD-MMM-YYYY">DD-MMM-YYYY</option>
            </select>
          </Field>

          <Field
            label="Number Format"
            description="Choose how numeric values should be displayed."
          >
            <select
              style={styles.input}
              value={appearance.numberFormat ?? "1,234.56"}
              onChange={(e) =>
                update("numberFormat", e.target.value)
              }
            >
              <option value="1,234.56">1,234.56</option>
              <option value="1.234,56">1.234,56</option>
              <option value="1 234.56">1 234.56</option>
            </select>
          </Field>

          <Field
            label="Show Decimal Places"
            description="Display decimal places for monetary and quantity values."
          >
            <Toggle
              checked={appearance.showDecimals !== false}
              onChange={(value) =>
                update("showDecimals", value)
              }
            />
          </Field>

          <Field
            label="Show Currency Symbol"
            description="Display the currency symbol with monetary amounts."
          >
            <Toggle
              checked={appearance.showCurrencySymbol !== false}
              onChange={(value) =>
                update(
                  "showCurrencySymbol",
                  value
                )
              }
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Accessibility"
        description="Improve readability and accessibility throughout the ERP."
      >
        <div style={styles.formStack}>
          <Field
            label="Reduce Animations"
            description="Reduce interface animations and transitions."
          >
            <Toggle
              checked={appearance.reduceAnimations === true}
              onChange={(value) =>
                update("reduceAnimations", value)
              }
            />
          </Field>

          <Field
            label="High Contrast"
            description="Increase visual contrast for improved readability."
          >
            <Toggle
              checked={appearance.highContrast === true}
              onChange={(value) =>
                update("highContrast", value)
              }
            />
          </Field>
        </div>
      </Card>

      <SaveFooter
        message={message}
        saving={saving}
        onSave={() => saveSection("appearance")}
      />
    </div>
  );
}
function DashboardSettings({
  settings,
  updateSectionValue,
  saveSection,
  saving,
  message,
}: {
  settings: any;
  updateSectionValue: (
    section: string,
    field: string,
    value: any
  ) => void;
  saveSection: (section: string) => Promise<void> | void;
  saving: boolean;
  message: string;
}) {
  const dashboard = settings?.dashboard || {};

  const update = (key: string, value: any) => {
    updateSectionValue("dashboard", key, value);
  };

  return (
    <div style={styles.sectionStack}>
      <SectionHeader
        title="Dashboard Settings"
        description="Configure which information and widgets are displayed on your ERP dashboard."
      />

      <Card
        title="Dashboard Layout"
        description="Choose how the main dashboard should be arranged."
      >
        <div style={styles.formGrid}>
          <Field
            label="Dashboard Layout"
            description="Select the default dashboard layout."
          >
            <select
              style={styles.input}
              value={dashboard.layout ?? "STANDARD"}
              onChange={(e) =>
                update("layout", e.target.value)
              }
            >
              <option value="STANDARD">Standard</option>
              <option value="COMPACT">Compact</option>
              <option value="WIDE">Wide</option>
            </select>
          </Field>

          <Field
            label="Widget Density"
            description="Control the amount of information shown inside dashboard widgets."
          >
            <select
              style={styles.input}
              value={dashboard.widgetDensity ?? "COMFORTABLE"}
              onChange={(e) =>
                update(
                  "widgetDensity",
                  e.target.value
                )
              }
            >
              <option value="COMPACT">Compact</option>
              <option value="COMFORTABLE">Comfortable</option>
              <option value="SPACIOUS">Spacious</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card
        title="KPI Cards"
        description="Choose which key performance indicators should appear at the top of the dashboard."
      >
        <div style={styles.formGrid}>
          <Field
            label="Sales"
            description="Show total sales and sales performance."
          >
            <Toggle
              checked={dashboard.showSalesKpi !== false}
              onChange={(value) =>
                update("showSalesKpi", value)
              }
            />
          </Field>

          <Field
            label="Purchases"
            description="Show total purchases and purchase performance."
          >
            <Toggle
              checked={dashboard.showPurchasesKpi !== false}
              onChange={(value) =>
                update("showPurchasesKpi", value)
              }
            />
          </Field>

          <Field
            label="Receivables"
            description="Show outstanding customer receivables."
          >
            <Toggle
              checked={dashboard.showReceivablesKpi !== false}
              onChange={(value) =>
                update(
                  "showReceivablesKpi",
                  value
                )
              }
            />
          </Field>

          <Field
            label="Payables"
            description="Show outstanding supplier payables."
          >
            <Toggle
              checked={dashboard.showPayablesKpi !== false}
              onChange={(value) =>
                update("showPayablesKpi", value)
              }
            />
          </Field>

          <Field
            label="Inventory Value"
            description="Show the current estimated inventory value."
          >
            <Toggle
              checked={dashboard.showInventoryKpi !== false}
              onChange={(value) =>
                update(
                  "showInventoryKpi",
                  value
                )
              }
            />
          </Field>

          <Field
            label="Cash Position"
            description="Show the current cash position."
          >
            <Toggle
              checked={dashboard.showCashKpi === true}
              onChange={(value) =>
                update("showCashKpi", value)
              }
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Dashboard Widgets"
        description="Control which operational widgets appear on the dashboard."
      >
        <div style={styles.formGrid}>
          <Field
            label="Sales Summary"
            description="Display the sales summary widget."
          >
            <Toggle
              checked={dashboard.showSalesSummary !== false}
              onChange={(value) =>
                update(
                  "showSalesSummary",
                  value
                )
              }
            />
          </Field>

          <Field
            label="Purchase Summary"
            description="Display the purchase summary widget."
          >
            <Toggle
              checked={dashboard.showPurchaseSummary !== false}
              onChange={(value) =>
                update(
                  "showPurchaseSummary",
                  value
                )
              }
            />
          </Field>

          <Field
            label="Inventory Summary"
            description="Display the inventory summary widget."
          >
            <Toggle
              checked={dashboard.showInventorySummary !== false}
              onChange={(value) =>
                update(
                  "showInventorySummary",
                  value
                )
              }
            />
          </Field>

          <Field
            label="Low Stock"
            description="Display products that are at or below their low-stock level."
          >
            <Toggle
              checked={dashboard.showLowStock !== false}
              onChange={(value) =>
                update("showLowStock", value)
              }
            />
          </Field>

          <Field
            label="Recent Invoices"
            description="Display recently created sales invoices."
          >
            <Toggle
              checked={dashboard.showRecentInvoices !== false}
              onChange={(value) =>
                update(
                  "showRecentInvoices",
                  value
                )
              }
            />
          </Field>

          <Field
            label="Recent Payments"
            description="Display recently recorded customer and supplier payments."
          >
            <Toggle
              checked={dashboard.showRecentPayments !== false}
              onChange={(value) =>
                update(
                  "showRecentPayments",
                  value
                )
              }
            />
          </Field>

          <Field
            label="Recent Purchases"
            description="Display recently created purchase bills."
          >
            <Toggle
              checked={dashboard.showRecentPurchases !== false}
              onChange={(value) =>
                update(
                  "showRecentPurchases",
                  value
                )
              }
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Charts"
        description="Control the financial and operational charts shown on the dashboard."
      >
        <div style={styles.formGrid}>
          <Field
            label="Sales Chart"
            description="Display sales trends over time."
          >
            <Toggle
              checked={dashboard.showSalesChart !== false}
              onChange={(value) =>
                update(
                  "showSalesChart",
                  value
                )
              }
            />
          </Field>

          <Field
            label="Purchase Chart"
            description="Display purchase trends over time."
          >
            <Toggle
              checked={dashboard.showPurchaseChart !== false}
              onChange={(value) =>
                update(
                  "showPurchaseChart",
                  value
                )
              }
            />
          </Field>

          <Field
            label="Profit Chart"
            description="Display profitability trends when accounting data is available."
          >
            <Toggle
              checked={dashboard.showProfitChart === true}
              onChange={(value) =>
                update(
                  "showProfitChart",
                  value
                )
              }
            />
          </Field>

          <Field
            label="Inventory Chart"
            description="Display inventory value and stock trends."
          >
            <Toggle
              checked={dashboard.showInventoryChart === true}
              onChange={(value) =>
                update(
                  "showInventoryChart",
                  value
                )
              }
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Quick Actions"
        description="Choose whether common ERP actions should be available directly from the dashboard."
      >
        <div style={styles.formGrid}>
          <Field
            label="Quick Actions"
            description="Show the dashboard quick-actions panel."
          >
            <Toggle
              checked={dashboard.showQuickActions !== false}
              onChange={(value) =>
                update(
                  "showQuickActions",
                  value
                )
              }
            />
          </Field>

          <Field
            label="New Sales Invoice"
            description="Show a shortcut for creating a sales invoice."
          >
            <Toggle
              checked={dashboard.quickNewSalesInvoice !== false}
              onChange={(value) =>
                update(
                  "quickNewSalesInvoice",
                  value
                )
              }
            />
          </Field>

          <Field
            label="New Purchase Bill"
            description="Show a shortcut for creating a purchase bill."
          >
            <Toggle
              checked={dashboard.quickNewPurchaseBill !== false}
              onChange={(value) =>
                update(
                  "quickNewPurchaseBill",
                  value
                )
              }
            />
          </Field>

          <Field
            label="New Customer"
            description="Show a shortcut for creating a customer."
          >
            <Toggle
              checked={dashboard.quickNewCustomer !== false}
              onChange={(value) =>
                update(
                  "quickNewCustomer",
                  value
                )
              }
            />
          </Field>

          <Field
            label="New Supplier"
            description="Show a shortcut for creating a supplier."
          >
            <Toggle
              checked={dashboard.quickNewSupplier !== false}
              onChange={(value) =>
                update(
                  "quickNewSupplier",
                  value
                )
              }
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Refresh & Data"
        description="Control how frequently dashboard information is refreshed."
      >
        <div style={styles.formGrid}>
          <Field
            label="Auto Refresh"
            description="Automatically refresh dashboard information."
          >
            <Toggle
              checked={dashboard.autoRefresh === true}
              onChange={(value) =>
                update("autoRefresh", value)
              }
            />
          </Field>

          <Field
            label="Refresh Interval"
            description="Select how often the dashboard should refresh."
          >
            <select
              style={styles.input}
              value={dashboard.refreshInterval ?? "5"}
              onChange={(e) =>
                update(
                  "refreshInterval",
                  e.target.value
                )
              }
            >
              <option value="1">Every 1 minute</option>
              <option value="5">Every 5 minutes</option>
              <option value="10">Every 10 minutes</option>
              <option value="15">Every 15 minutes</option>
              <option value="30">Every 30 minutes</option>
            </select>
          </Field>
        </div>
      </Card>

      <SaveFooter
        message={message}
        saving={saving}
        onSave={() => saveSection("dashboard")}
      />
    </div>
  );
}
function AccountingSettings({
  settings,
  accounts,
  updateSectionValue,
  saveSection,
  saving,
  message,
}: {
  settings: any;
  accounts: any[];
  updateSectionValue: (
    section: string,
    field: string,
    value: any
  ) => void;
  saveSection: (section: string) => Promise<void> | void;
  saving: boolean;
  message: string;
}) {
  const accounting = settings?.accounting || {};

  const update = (key: string, value: any) => {
    updateSectionValue("accounting", key, value);
  };

  const accountOptions = [
    {
      value: "",
      label: "Select account",
    },
    ...accounts.map((account) => ({
      value: account.id,
      label: `${account.code} — ${account.name}`,
    })),
  ];

  return (
    <div style={styles.sectionStack}>
      <SectionHeader
        title="Accounting Settings"
        description="Configure accounting defaults, posting behaviour and journal controls."
      />

      <Card
        title="Default Accounts"
        description="Choose the accounts that should be used automatically throughout the ERP."
      >
        <div style={styles.formGrid}>
          <Field
            label="Accounts Receivable"
            description="Default receivable account for customer invoices."
          >
            <select
              style={styles.input}
              value={accounting.accountsReceivableAccountId ?? ""}
              onChange={(e) =>
                update(
                  "accountsReceivableAccountId",
                  e.target.value || null
                )
              }
            >
              {accountOptions.map((account) => (
                <option key={account.value} value={account.value}>
                  {account.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Accounts Payable"
            description="Default payable account for supplier bills."
          >
            <select
              style={styles.input}
              value={accounting.accountsPayableAccountId ?? ""}
              onChange={(e) =>
                update(
                  "accountsPayableAccountId",
                  e.target.value || null
                )
              }
            >
              {accountOptions.map((account) => (
                <option key={account.value} value={account.value}>
                  {account.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Default Sales Account"
            description="Income account used when no product-specific sales account is configured."
          >
            <select
              style={styles.input}
              value={accounting.defaultSalesAccountId ?? ""}
              onChange={(e) =>
                update(
                  "defaultSalesAccountId",
                  e.target.value || null
                )
              }
            >
              {accountOptions.map((account) => (
                <option key={account.value} value={account.value}>
                  {account.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Default Purchase Account"
            description="Purchase account used when no product-specific purchase account is configured."
          >
            <select
              style={styles.input}
              value={accounting.defaultPurchaseAccountId ?? ""}
              onChange={(e) =>
                update(
                  "defaultPurchaseAccountId",
                  e.target.value || null
                )
              }
            >
              {accountOptions.map((account) => (
                <option key={account.value} value={account.value}>
                  {account.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Default Inventory Account"
            description="Asset account used for inventory valuation."
          >
            <select
              style={styles.input}
              value={accounting.defaultInventoryAccountId ?? ""}
              onChange={(e) =>
                update(
                  "defaultInventoryAccountId",
                  e.target.value || null
                )
              }
            >
              {accountOptions.map((account) => (
                <option key={account.value} value={account.value}>
                  {account.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Default COGS Account"
            description="Expense account used for cost of goods sold."
          >
            <select
              style={styles.input}
              value={accounting.defaultCogsAccountId ?? ""}
              onChange={(e) =>
                update(
                  "defaultCogsAccountId",
                  e.target.value || null
                )
              }
            >
              {accountOptions.map((account) => (
                <option key={account.value} value={account.value}>
                  {account.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Default Discount Allowed Account"
            description="Expense account used to record sales discounts."
          >
            <select
              style={styles.input}
              value={accounting.discountAccountId ?? ""}
              onChange={(e) =>
                update(
                  "discountAccountId",
                  e.target.value || null
                )
              }
            >
              {accountOptions.map((account) => (
                <option key={account.value} value={account.value}>
                  {account.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Default Delivery Charges Account"
            description="Revenue account used for delivery and shipping fees."
          >
            <select
              style={styles.input}
              value={accounting.deliveryAccountId ?? ""}
              onChange={(e) =>
                update(
                  "deliveryAccountId",
                  e.target.value || null
                )
              }
            >
              {accountOptions.map((account) => (
                <option key={account.value} value={account.value}>
                  {account.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <Card
        title="Automatic Posting"
        description="Control when accounting entries are created by ERP transactions."
      >
        <div style={styles.formStack}>
          <Field
            label="Auto-post Sales Invoices"
            description="Automatically create accounting entries when sales invoices are posted."
          >
            <Toggle
              checked={accounting.autoPostSalesInvoices !== false}
              onChange={(value) =>
                update("autoPostSalesInvoices", value)
              }
            />
          </Field>

          <Field
            label="Auto-post Purchase Bills"
            description="Automatically create accounting entries when purchase bills are posted."
          >
            <Toggle
              checked={accounting.autoPostPurchaseBills !== false}
              onChange={(value) =>
                update("autoPostPurchaseBills", value)
              }
            />
          </Field>

          <Field
            label="Auto-post Payments"
            description="Automatically create accounting entries for customer and supplier payments."
          >
            <Toggle
              checked={accounting.autoPostPayments !== false}
              onChange={(value) =>
                update("autoPostPayments", value)
              }
            />
          </Field>

          <Field
            label="Auto-post Inventory Accounting"
            description="Automatically record inventory asset and COGS accounting entries."
          >
            <Toggle
              checked={accounting.autoPostInventory !== false}
              onChange={(value) =>
                update("autoPostInventory", value)
              }
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Journal Controls"
        description="Set rules for manual and posted accounting entries."
      >
        <div style={styles.formStack}>
          <Field
            label="Allow Manual Journal Entries"
            description="Allow users to create manual journal entries."
          >
            <Toggle
              checked={accounting.allowManualJournals !== false}
              onChange={(value) =>
                update("allowManualJournals", value)
              }
            />
          </Field>

          <Field
            label="Require Balanced Journals"
            description="Prevent saving a journal entry unless total debits equal total credits."
          >
            <Toggle
              checked={accounting.requireBalancedJournals !== false}
              onChange={(value) =>
                update("requireBalancedJournals", value)
              }
            />
          </Field>

          <Field
            label="Allow Editing Posted Entries"
            description="Allow posted accounting entries to be edited."
          >
            <Toggle
              checked={accounting.allowEditPostedEntries === true}
              onChange={(value) =>
                update("allowEditPostedEntries", value)
              }
            />
          </Field>

          <Field
            label="Allow Deleting Posted Entries"
            description="Allow posted accounting entries to be deleted."
          >
            <Toggle
              checked={accounting.allowDeletePostedEntries === true}
              onChange={(value) =>
                update("allowDeletePostedEntries", value)
              }
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Fiscal Period Controls"
        description="Protect completed accounting periods from accidental changes."
      >
        <div style={styles.formStack}>
          <Field
            label="Lock Accounting Periods"
            description="Prevent transactions from being entered into locked accounting periods."
          >
            <Toggle
              checked={accounting.lockAccountingPeriods === true}
              onChange={(value) =>
                update("lockAccountingPeriods", value)
              }
            />
          </Field>
        </div>
      </Card>

      <SaveFooter
        message={message}
        saving={saving}
        onSave={() => saveSection("accounting")}
      />
    </div>
  );
}
function InventorySettings({
  settings,
  updateSectionValue,
  saveSection,
  saving,
  message,
}: any) {
  const inventory = settings?.inventory || {};

  const update = (key: string, value: any) => {
    updateSectionValue("inventory", key, value);
  };

  return (
    <div style={styles.sectionStack}>
      <Card
        title="Inventory Tracking"
        description="Configure how products and stock quantities are tracked."
      >
        <Field
          label="Enable Inventory Tracking"
          description="Track stock quantities for inventory products."
        >
          <Toggle
            checked={inventory.enableInventoryTracking !== false}
            onChange={(value: boolean) =>
              update("enableInventoryTracking", value)
            }
          />
        </Field>

        <Field
          label="Enable Batch Tracking"
          description="Track inventory using individual purchase batches and cost layers."
        >
          <Toggle
            checked={inventory.enableBatchTracking !== false}
            onChange={(value: boolean) =>
              update("enableBatchTracking", value)
            }
          />
        </Field>

        <Field
          label="Require Warehouse"
          description="Require a warehouse for inventory transactions."
        >
          <Toggle
            checked={inventory.requireWarehouse !== false}
            onChange={(value: boolean) =>
              update("requireWarehouse", value)
            }
          />
        </Field>

        <Field
          label="Allow Negative Stock"
          description="Allow sales or adjustments to reduce stock below zero."
        >
          <Toggle
            checked={inventory.allowNegativeStock === true}
            onChange={(value: boolean) =>
              update("allowNegativeStock", value)
            }
          />
        </Field>
      </Card>

      <Card
        title="Inventory Costing"
        description="Configure how inventory costs are determined."
      >
        <Field
          label="Costing Method"
          description="Select the method used to determine inventory cost and COGS."
        >
          <select
            style={styles.select}
            value={inventory.costingMethod ?? "BATCH"}
            onChange={(e) =>
              update("costingMethod", e.target.value)
            }
          >
            <option value="BATCH">Batch Cost</option>
            <option value="FIFO">FIFO</option>
            <option value="AVERAGE">Average Cost</option>
          </select>
        </Field>

        <Field
          label="Use Actual Batch Cost"
          description="Use the selected inventory batch cost when calculating COGS."
        >
          <Toggle
            checked={inventory.useActualBatchCost !== false}
            onChange={(value: boolean) =>
              update("useActualBatchCost", value)
            }
          />
        </Field>

        <Field
          label="Update Average Cost"
          description="Maintain the warehouse-level average inventory cost."
        >
          <Toggle
            checked={inventory.updateAverageCost !== false}
            onChange={(value: boolean) =>
              update("updateAverageCost", value)
            }
          />
        </Field>
      </Card>

      <Card
        title="Stock Operations"
        description="Control how inventory transactions affect stock."
      >
        <Field
          label="Update Stock Automatically"
          description="Automatically update stock when inventory transactions are posted."
        >
          <Toggle
            checked={inventory.autoUpdateStock !== false}
            onChange={(value: boolean) =>
              update("autoUpdateStock", value)
            }
          />
        </Field>

        <Field
          label="Allow Stock Adjustments"
          description="Allow authorized users to increase or decrease stock manually."
        >
          <Toggle
            checked={inventory.allowAdjustments !== false}
            onChange={(value: boolean) =>
              update("allowAdjustments", value)
            }
          />
        </Field>

        <Field
          label="Allow Warehouse Transfers"
          description="Allow inventory to be transferred between warehouses."
        >
          <Toggle
            checked={inventory.allowTransfers !== false}
            onChange={(value: boolean) =>
              update("allowTransfers", value)
            }
          />
        </Field>

        <Field
          label="Allow Opening Stock"
          description="Allow opening inventory balances to be entered for products."
        >
          <Toggle
            checked={inventory.allowOpeningStock !== false}
            onChange={(value: boolean) =>
              update("allowOpeningStock", value)
            }
          />
        </Field>
      </Card>

      <Card
        title="Stock Alerts"
        description="Configure low-stock and reorder behaviour."
      >
        <Field
          label="Enable Reorder Alerts"
          description="Show products when their available quantity reaches the reorder level."
        >
          <Toggle
            checked={inventory.enableReorderAlerts !== false}
            onChange={(value: boolean) =>
              update("enableReorderAlerts", value)
            }
          />
        </Field>

        <Field
          label="Use Product Reorder Level"
          description="Use the reorder level configured on each product."
        >
          <Toggle
            checked={inventory.useProductReorderLevel !== false}
            onChange={(value: boolean) =>
              update("useProductReorderLevel", value)
            }
          />
        </Field>
      </Card>

      <SaveFooter
        message="Configure your inventory tracking, costing and stock behaviour here."
        saving={false}
        onSave={() => saveSection("inventory")}
      />
    </div>
  );
}
const styles: Record<string, React.CSSProperties> = {
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px", marginBottom: "30px" },
  title: { margin: 0, fontSize: "28px", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" },
  subtitle: { margin: "6px 0 0", fontSize: "14px", color: "#6b7280" },
  layout: { display: "flex", gap: "40px", alignItems: "flex-start" },
  sidebar: {
    width: "220px", flexShrink: 0, background: "transparent",
    position: "sticky", top: "24px", display: "flex", flexDirection: "column", gap: "4px"
  },
  sidebarTitle: {
    padding: "0 10px 10px", fontSize: "12px", fontWeight: 800,
    color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em",
  },
  navButton: {
    width: "100%", border: 0, background: "transparent", borderRadius: "8px",
    padding: "10px 14px", display: "flex", alignItems: "center", gap: "8px",
    textAlign: "left", cursor: "pointer", fontSize: "14px", fontWeight: 600,
    color: "#4b5563", transition: "all 0.2s ease"
  },
  navButtonActive: { background: "#e5e7eb", color: "#111827" },
  navIndicator: { display: "none" },
  navIndicatorActive: { display: "none" },
  content: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "24px" },
  sectionHeader: { marginBottom: "24px" },
  sectionTitle: { margin: 0, fontSize: "22px", fontWeight: 800, color: "#111827", letterSpacing: "-0.01em" },
  sectionDescription: { margin: "6px 0 0", fontSize: "14px", color: "#6b7280" },
  card: {
    background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden"
  },
  cardHeader: { padding: "20px 24px", borderBottom: "1px solid #e5e7eb", background: "#fbfcfe" },
  cardTitle: { margin: 0, fontSize: "16px", fontWeight: 700, color: "#111827" },
  cardDescription: { margin: "5px 0 0", fontSize: "13px", color: "#6b7280" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "24px", padding: "24px" },
  formStack: { display: "flex", flexDirection: "column", gap: "24px", padding: "24px" },
  field: { display: "flex", flexDirection: "column", gap: "8px" },
  label: { fontSize: "13px", fontWeight: 700, color: "#374151" },
  fieldDescription: { fontSize: "12px", color: "#6b7280", marginBottom: "4px" },
  input: {
    width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db",
    borderRadius: "8px", padding: "11px 13px", background: "#ffffff",
    color: "#111827", fontSize: "14px", outline: "none", transition: "border-color 0.2s"
  },
  toggle: {
    width: "100%", border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px",
    display: "flex", alignItems: "center", gap: "12px", cursor: "pointer",
    background: "#ffffff", textAlign: "left", transition: "all 0.2s"
  },
  toggleOn: { borderColor: "#111827", background: "#f8fafc" },
  toggleOff: { background: "#ffffff" },
  toggleKnob: { width: "36px", height: "20px", borderRadius: "20px", position: "relative", flexShrink: 0, transition: "background 0.2s" },
  toggleKnobOn: { background: "#111827" },
  toggleKnobOff: { background: "#d1d5db" },
  toggleText: { fontSize: "13px", fontWeight: 600, color: "#374151" },
  footer: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 0 10px", borderTop: "1px solid #e5e7eb", marginTop: "10px" },
  message: { fontSize: "14px", color: "#059669", fontWeight: 600 },
  saveButton: { border: 0, borderRadius: "8px", padding: "12px 24px", background: "#111827", color: "#ffffff", fontSize: "14px", fontWeight: 700, cursor: "pointer", transition: "opacity 0.2s" },
  saveButtonDisabled: { opacity: 0.6, cursor: "not-allowed" },
  numberingCard: { border: "1px solid #e5e7eb", borderRadius: "12px", padding: "24px", background: "#ffffff", marginBottom: "16px" },
  numberingHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "20px", marginBottom: "20px" },
  numberingTitle: { margin: 0, fontSize: "16px", fontWeight: 700, color: "#111827" },
  numberingDescription: { margin: "5px 0 0", fontSize: "13px", color: "#6b7280" },
  numberingPreview: { padding: "10px 16px", borderRadius: "8px", background: "#f3f4f6", border: "1px solid #e5e7eb", textAlign: "right" },
  numberingPreviewLabel: { display: "block", marginBottom: "4px", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase" },
  numberingExamples: { display: "flex", flexDirection: "column" },
  exampleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid #e5e7eb", fontSize: "14px", color: "#374151", fontWeight: 500 },
  emptyState: { minHeight: "300px", background: "#ffffff", border: "1px dashed #d1d5db", borderRadius: "12px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px" },
  emptyIcon: { fontSize: "36px", marginBottom: "16px", opacity: 0.5 },
  emptyTitle: { margin: 0, fontSize: "20px", fontWeight: 700, color: "#111827" },
  emptyDescription: { maxWidth: "400px", margin: "8px 0 0", fontSize: "14px", color: "#6b7280" },
  sectionStack: { display: "flex", flexDirection: "column", gap: "24px" },
  companyBadge: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", border: "1px solid #e5e7eb", borderRadius: "99px", background: "#ffffff", fontSize: "13px", fontWeight: 700, color: "#374151", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" },
  companyDot: { width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" },
  loading: { padding: "100px", textAlign: "center", color: "#6b7280", fontSize: "15px", fontWeight: 600 }
};

function TemplatesSettings({ settings, updateSectionValue, saveSection, saving, message }: any) {
  const templates = settings?.templates || {};
  const update = (key: string, value: any) => updateSectionValue("templates", key, value);

  return (
    <div style={styles.sectionStack}>
      <SectionHeader title="Document Templates" description="Customize the appearance, terms, and bank details displayed on printed invoices and bills." />
      
      <Card title="Visual Identity" description="Set the primary brand color and document titles.">
        <div style={styles.formGrid}>
          <Field label="Primary Brand Color" description="Click to select the accent color for your tables and headers.">
            <input type="color" value={templates.primaryColor || "#4f46e5"} onChange={e => update("primaryColor", e.target.value)} style={{...styles.input, height: "44px", padding: "4px", cursor: "pointer"}} />
          </Field>
          <Field label="Invoice Document Title" description="e.g., TAX INVOICE, SALES RECEIPT, or PROFORMA">
            <input type="text" value={templates.invoiceTitle || "INVOICE"} onChange={e => update("invoiceTitle", e.target.value)} style={styles.input} placeholder="INVOICE" />
          </Field>
        </div>
      </Card>

      <Card title="Payment & Terms" description="Provide bank transfer details and legal terms to display at the bottom of customer invoices.">
        <div style={styles.formStack}>
          <Field label="Bank Transfer Details" description="This will appear prominently above the total calculation.">
            <textarea value={templates.bankDetails || ""} onChange={e => update("bankDetails", e.target.value)} style={{...styles.input, minHeight: "100px", resize: "vertical", fontFamily: "inherit"}} placeholder="Bank Name: Habib Bank Limited&#10;Account Title: Izan Bling&#10;IBAN: PK..."></textarea>
          </Field>
          <Field label="Terms & Conditions" description="Legal terms or payment rules (appears in the bottom left footer).">
            <textarea value={templates.terms || ""} onChange={e => update("terms", e.target.value)} style={{...styles.input, minHeight: "100px", resize: "vertical", fontFamily: "inherit"}} placeholder="1. Payment is due within 15 days.&#10;2. Goods once sold cannot be returned."></textarea>
          </Field>
          <Field label="Footer Note" description="A friendly closing message (appears in the bottom right footer).">
            <textarea value={templates.footerNote || ""} onChange={e => update("footerNote", e.target.value)} style={{...styles.input, minHeight: "60px", resize: "vertical", fontFamily: "inherit"}} placeholder="Thank you for your business!"></textarea>
          </Field>
        </div>
      </Card>
      
      <SaveFooter message={message} saving={saving} onSave={() => saveSection("templates")} />
    </div>
  );
}
