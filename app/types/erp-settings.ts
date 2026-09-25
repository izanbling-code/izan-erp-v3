export interface GeneralSettings {
  companyName: string;
  legalName: string;
  ntn: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  currency: string;
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  timeZone: string;
  decimalPlaces: number;
}

export interface PurchaseSettings {
  defaultBillStatus: "DRAFT" | "POSTED";
  defaultPaymentTerms: string;
  allowDiscounts: boolean;
  allowTax: boolean;
  requireWarehouse: boolean;
  requireBatch: boolean;
  inventoryUpdateTiming: "ON_POST" | "ON_RECEIPT";
}

export interface SalesSettings {
  allowCashSales: boolean;
  allowPartialPayments: boolean;
  requireCustomer: boolean;
  requireWarehouse: boolean;
  requireBatchSelection: boolean;
}

export interface InventorySettings {
  allowNegativeStock: boolean;
  allowStockAdjustments: boolean;
  costingMethod: "BATCH_ACTUAL" | "MOVING_AVERAGE";
  enableReorderAlerts: boolean;
}

export interface NumberingSettings {
  invoicePrefix: string;
  purchaseBillPrefix: string;
  journalPrefix: string;
  nextInvoiceNumber: number;
  nextPurchaseBillNumber: number;
}

export interface ERPSystemSettings {
  general: GeneralSettings;
  purchases: PurchaseSettings;
  sales: SalesSettings;
  inventory: InventorySettings;
  numbering: NumberingSettings;
}

export const DEFAULT_ERP_SETTINGS: ERPSystemSettings = {
  general: {
    companyName: "Izan Bling",
    legalName: "",
    ntn: "",
    email: "",
    phone: "",
    address: "",
    country: "Pakistan",
    currency: "PKR",
    dateFormat: "DD/MM/YYYY",
    timeZone: "Asia/Karachi",
    decimalPlaces: 2,
  },
  purchases: {
    defaultBillStatus: "DRAFT",
    defaultPaymentTerms: "Net 30",
    allowDiscounts: true,
    allowTax: true,
    requireWarehouse: true,
    requireBatch: true,
    inventoryUpdateTiming: "ON_POST",
  },
  sales: {
    allowCashSales: true,
    allowPartialPayments: true,
    requireCustomer: true,
    requireWarehouse: true,
    requireBatchSelection: true,
  },
  inventory: {
    allowNegativeStock: false,
    allowStockAdjustments: true,
    costingMethod: "BATCH_ACTUAL",
    enableReorderAlerts: true,
  },
  numbering: {
    invoicePrefix: "INV-",
    purchaseBillPrefix: "PB-",
    journalPrefix: "JRN-",
    nextInvoiceNumber: 1,
    nextPurchaseBillNumber: 1,
  },
};
