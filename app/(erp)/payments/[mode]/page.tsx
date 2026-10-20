import PaymentWorkspace from "../payment-workspace";

type Mode =
  | "expense"
  | "supplier"
  | "receive";

export default async function PaymentModePage({
  params,
}: {
  params: Promise<{
    mode: string;
  }>;
}) {
  const { mode } = await params;

  if (
    ![
      "expense",
      "supplier",
      "receive",
    ].includes(mode)
  ) {
    return (
      <div className="dashboard">
        <h1>Payment mode not found</h1>
      </div>
    );
  }

  return (
    <PaymentWorkspace
      mode={mode as Mode}
    />
  );
}