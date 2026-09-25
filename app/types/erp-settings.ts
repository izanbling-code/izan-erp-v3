export interface GeneralSettings {
  companyName: string;
  legalName: string;
  ntn: string;
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
  inventoryUpdateTiming: "POSTED" | "RECEIVED";
  allowPurchaseReturns: boolean;
  requireSupplier: boolean;
  allowPartialPayments: boolean;
  autoCalculateBalance: boolean;
}

export interface SalesSettings {
  requireWarehouse: boolean;
  requireBatchSelection: boolean;
  allowNegativeStock: boolean;
  updateInventoryOn: string;
  allowCashSales: boolean;
  requireCustomer: boolean;
  allowPartialPayments: boolean;
  autoCalculateBalance: boolean;
}

export interface InventorySettings {
  enableInventoryTracking: boolean;
  enableBatchTracking: boolean;
  requireWarehouse: boolean;
  allowNegativeStock: boolean;
  costingMethod: string;
  useActualBatchCost: boolean;
  updateAverageCost: boolean;
  updateStockAutomatically: boolean;
  allowStockAdjustments: boolean;
  allowWarehouseTransfers: boolean;
  allowOpeningStock: boolean;
  enableReorderAlerts: boolean;
  useProductReorderLevel: boolean;
}

export interface ERPSystemSettings {
  general: GeneralSettings;
  purchases: PurchaseSettings;
  sales: SalesSettings;
  inventory: InventorySettings;
}

export const DEFAULT_ERP_SETTINGS: ERPSystemSettings = {
  general: {
    companyName: "Izan Bling",
    legalName: "",
    ntn: "J075690-0",
    country: "Pakistan",
    currency: "PKR",
    dateFormat: "DD/MM/YYYY",
    timeZone: "Asia/Karachi",
    decimalPlaces: 2,
  },
  purchases: {
    defaultBillStatus: "DRAFT",
    defaultPaymentTerms: "Due on Receipt",
    allowDiscounts: true,
    allowTax: true,
    requireWarehouse: true,
    requireBatch: true,
    inventoryUpdateTiming: "POSTED",
    allowPurchaseReturns: true,
    requireSupplier: true,
    allowPartialPayments: true,
    autoCalculateBalance: true,
  },
  sales: {
    requireWarehouse: true,
    requireBatchSelection: true,
    allowNegativeStock: false,
    updateInventoryOn: "Invoice Posting",
    allowCashSales: true,
    requireCustomer: true,
    allowPartialPayments: true,
    autoCalculateBalance: true,
  },
  inventory: {
    enableInventoryTracking: true,
    enableBatchTracking: false,
    requireWarehouse: true,
    allowNegativeStock: false,
    costingMethod: "Batch Cost",
    useActualBatchCost: true,
    updateAverageCost: true,
    updateStockAutomatically: true,
    allowStockAdjustments: true,
    allowWarehouseTransfers: true,
    allowOpeningStock: true,
    enableReorderAlerts: true,
    useProductReorderLevel: true,
  },
};
