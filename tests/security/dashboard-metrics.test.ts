import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dashboardMetrics,
  type DashboardTransaction,
} from "../../services/dashboardMetrics.ts";
const tx = (
  amount: number,
  type: string,
  status: string,
  date: string,
): DashboardTransaction => ({
  id: date + amount,
  title: "Test",
  amount,
  type,
  status,
  date,
});
test("dashboard cash excludes pending and cancelled entries and keeps receivables separate", () => {
  const result = dashboardMetrics(
    [
      tx(1000, "income", "paid", "2026-01-01"),
      tx(250, "expense", "paid", "2026-01-31"),
      tx(400, "income", "pending", "2026-01-15"),
      tx(900, "expense", "pending", "2026-01-15"),
      tx(500, "income", "cancelled", "2026-01-15"),
    ],
    new Date(2026, 0, 15),
  );
  assert.equal(result.balance, 750);
  assert.equal(result.received, 1000);
  assert.equal(result.spent, 250);
  assert.equal(result.receivable, 400);
  assert.equal(result.months[5].receita, 1000);
});
test("month grouping handles year boundary and date-only values without timezone shifts", () => {
  const result = dashboardMetrics(
    [
      tx(100, "income", "paid", "2025-12-31"),
      tx(200, "income", "paid", "2026-01-01"),
      tx(999, "income", "paid", "2025-01-01"),
      tx(999, "income", "paid", "2026-02-01"),
    ],
    new Date(2026, 0, 15),
  );
  assert.equal(result.received, 200);
  assert.equal(result.months[4].receita, 100);
  assert.equal(result.months[5].receita, 200);
  assert.equal(result.months.length, 6);
});
