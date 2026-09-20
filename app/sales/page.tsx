import Link from "next/link";

const modules = [
  {
    title: "Invoices",
    description: "Create, manage and review customer sales invoices.",
    href: "/sales/invoices",
    icon: "INV",
  },
  {
    title: "Customers",
    description: "Manage customers, balances and customer accounts.",
    href: "/sales/customers",
    icon: "CUS",
  },
  {
    title: "Payments",
    description: "Record and manage payments received from customers.",
    href: "/sales/payments",
    icon: "PAY",
  },
];

export default function SalesPage() {
  return (
    <div className="sales-page">
      <header className="sales-page-header">
        <div>
          <span className="sales-eyebrow">Transactions</span>
          <h1>Sales</h1>
          <p>Manage invoices, customers and customer payments.</p>
        </div>

        <Link href="/sales/invoices/new" className="sales-primary-button">
          <span>+</span>
          New Invoice
        </Link>
      </header>

      <section className="sales-summary-grid">
        <div className="sales-summary-card">
          <div className="sales-summary-card-top">
            <span>Sales invoices</span>
            <span className="sales-summary-dot" />
          </div>
          <strong>0</strong>
          <small>Total invoices</small>
        </div>

        <div className="sales-summary-card">
          <div className="sales-summary-card-top">
            <span>Receivables</span>
            <span className="sales-summary-dot" />
          </div>
          <strong>₨ 0.00</strong>
          <small>Outstanding</small>
        </div>

        <div className="sales-summary-card">
          <div className="sales-summary-card-top">
            <span>Customers</span>
            <span className="sales-summary-dot" />
          </div>
          <strong>0</strong>
          <small>Active customers</small>
        </div>

        <div className="sales-summary-card">
          <div className="sales-summary-card-top">
            <span>Payments</span>
            <span className="sales-summary-dot" />
          </div>
          <strong>₨ 0.00</strong>
          <small>Received</small>
        </div>
      </section>

      <section className="sales-panel">
        <div className="sales-panel-header">
          <div>
            <h2>Sales operations</h2>
            <p>Access the main sales functions.</p>
          </div>
        </div>

        <div className="sales-module-grid" style={{ padding: 18 }}>
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="sales-module-card"
            >
              <div className="sales-module-icon">{module.icon}</div>

              <h3>{module.title}</h3>

              <p>{module.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}