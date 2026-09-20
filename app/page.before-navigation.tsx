import ErpShell from "./components/erp-shell";

const summaryCards = [
  {
    title: "Sales",
    value: "Rs. 0",
    subtitle: "This month",
  },
  {
    title: "Purchases",
    value: "Rs. 0",
    subtitle: "This month",
  },
  {
    title: "Receivables",
    value: "Rs. 0",
    subtitle: "Outstanding",
  },
  {
    title: "Payables",
    value: "Rs. 0",
    subtitle: "Outstanding",
  },
];

const quickActions = [
  "New Sales Invoice",
  "New Purchase Bill",
  "Receive Payment",
  "Add Product",
];

export default function Home() {
  return (
    <ErpShell>
      <div className="dashboard">
        <section className="dashboard-heading">
          <div>
            <p className="eyebrow">Overview</p>
            <h1>Dashboard</h1>
            <p className="dashboard-description">
              Welcome to your Izan Bling ERP workspace.
            </p>
          </div>

          <div className="dashboard-date">
            <span>Fiscal year</span>
            <strong>2026</strong>
          </div>
        </section>

        <section className="summary-grid">
          {summaryCards.map((card) => (
            <div className="summary-card" key={card.title}>
              <div className="summary-card-top">
                <span>{card.title}</span>
                <span className="summary-card-dot" />
              </div>

              <strong>{card.value}</strong>
              <small>{card.subtitle}</small>
            </div>
          ))}
        </section>

        <section className="dashboard-grid">
          <div className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Activity</p>
                <h2>Recent transactions</h2>
              </div>

              <button type="button" className="panel-link">
                View all
              </button>
            </div>

            <div className="empty-state">
              <div className="empty-state-icon">▤</div>
              <h3>No transactions yet</h3>
              <p>
                Sales invoices, purchase bills and payments will appear here
                once you start using the ERP.
              </p>
            </div>
          </div>

          <div className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Shortcuts</p>
                <h2>Quick actions</h2>
              </div>
            </div>

            <div className="quick-actions">
              {quickActions.map((action) => (
                <button type="button" key={action} className="quick-action">
                  <span className="quick-action-icon">+</span>
                  <span>{action}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="dashboard-panel system-status">
          <div>
            <p className="eyebrow">System</p>
            <h2>ERP infrastructure</h2>
          </div>

          <div className="status-items">
            <div className="status-item">
              <span className="status-dot" />
              <span>Database</span>
              <strong>Connected</strong>
            </div>

            <div className="status-item">
              <span className="status-dot" />
              <span>Prisma</span>
              <strong>Ready</strong>
            </div>

            <div className="status-item">
              <span className="status-dot" />
              <span>ERP Schema</span>
              <strong>Ready</strong>
            </div>
          </div>
        </section>
      </div>
    </ErpShell>
  );
}
