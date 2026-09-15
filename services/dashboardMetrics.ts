export type DashboardTransaction = {
  id: string;
  title: string;
  amount: number;
  type: string;
  date: string;
  status: string;
};
export function dashboardMetrics(
  transactions: DashboardTransaction[],
  now = new Date(),
) {
  const monthKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const current = monthKey(now);
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return {
      key: monthKey(date),
      mes: date
        .toLocaleDateString("pt-BR", { month: "short" })
        .replace(".", ""),
      receita: 0,
      despesa: 0,
    };
  });
  let received = 0,
    spent = 0,
    receivable = 0;
  for (const tx of transactions) {
    const amount = Number(tx.amount || 0);
    const key = tx.date.slice(0, 7);
    if (key === current) {
      if (tx.status === "paid" && tx.type === "income") received += amount;
      if (tx.status === "paid" && tx.type === "expense") spent += amount;
      if (tx.status === "pending" && tx.type === "income") receivable += amount;
    }
    const month = months.find((m) => m.key === key);
    if (month && tx.status === "paid") {
      if (tx.type === "income") month.receita += amount;
      if (tx.type === "expense") month.despesa += amount;
    }
  }
  return { received, spent, receivable, balance: received - spent, months };
}
