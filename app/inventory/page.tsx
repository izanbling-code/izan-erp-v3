import Link from "next/link";

const modules = [
  {
    title: "Products",
    description: "Create and manage products, pricing and accounting settings.",
    href: "/inventory/products",
    icon: "PRD",
  },
  {
    title: "Stock",
    description: "View current quantities and inventory availability.",
    href: "/inventory/stock",
    icon: "STK",
  },
  {
    title: "Stock Movements",
    description: "Review inventory receipts, issues and adjustments.",
    href: "/inventory/movements",
    icon: "MOV",
  },
  {
    title: "Warehouses",
    description: "Manage warehouses and inventory locations.",
    href: "/inventory/warehouses",
    icon: "WH",
  },
];

export default function InventoryPage() {
  return (
    <div className="inventory-page">
      <header className="inventory-page-header">
        <div>
          <span className="inventory-eyebrow">Inventory</span>
          <h1>Inventory</h1>
          <p>Manage products, stock, movements and warehouses.</p>
        </div>

        <Link
          href="/inventory/products"
          className="inventory-primary-button"
        >
          Products
        </Link>
      </header>

      <section className="inventory-summary-grid">
        <div className="inventory-summary-card">
          <div className="inventory-summary-card-top">
            <span>Products</span>
            <span className="inventory-summary-dot" />
          </div>
          <strong>0</strong>
          <small>Active products</small>
        </div>

        <div className="inventory-summary-card">
          <div className="inventory-summary-card-top">
            <span>Stock units</span>
            <span className="inventory-summary-dot" />
          </div>
          <strong>0</strong>
          <small>Total quantity</small>
        </div>

        <div className="inventory-summary-card">
          <div className="inventory-summary-card-top">
            <span>Low stock</span>
            <span className="inventory-summary-dot" />
          </div>
          <strong>0</strong>
          <small>Products below reorder level</small>
        </div>

        <div className="inventory-summary-card">
          <div className="inventory-summary-card-top">
            <span>Warehouses</span>
            <span className="inventory-summary-dot" />
          </div>
          <strong>0</strong>
          <small>Active locations</small>
        </div>
      </section>

      <section className="inventory-panel">
        <div className="inventory-panel-header">
          <div>
            <h2>Inventory operations</h2>
            <p>Access the main inventory functions.</p>
          </div>
        </div>

        <div
          className="inventory-module-grid"
          style={{ padding: 18 }}
        >
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="inventory-module-card"
            >
              <div className="inventory-module-icon">
                {module.icon}
              </div>

              <h3>{module.title}</h3>

              <p>{module.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}