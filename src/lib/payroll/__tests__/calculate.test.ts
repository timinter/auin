import { describe, it, expect } from "vitest";
import { calculatePayrollTotal, PayrollFields } from "../calculate";

const base: PayrollFields & { period: { working_days: number } } = {
  days_worked: 22,
  gross_salary: 5000,
  bonus: 0,
  compensation_amount: 0,
  period: { working_days: 22 },
};

describe("calculatePayrollTotal", () => {
  it("returns full salary when all days worked", () => {
    const { proratedGross, totalAmount } = calculatePayrollTotal(base, {});
    expect(proratedGross).toBe(5000);
    expect(totalAmount).toBe(5000);
  });

  it("prorates salary for partial month", () => {
    const { proratedGross, totalAmount } = calculatePayrollTotal(base, { days_worked: 11 });
    expect(proratedGross).toBe(2500);
    expect(totalAmount).toBe(2500);
  });

  it("adds bonus to total", () => {
    const { proratedGross, totalAmount } = calculatePayrollTotal(base, { bonus: 300 });
    expect(proratedGross).toBe(5000);
    expect(totalAmount).toBe(5300);
  });

  it("adds compensation to total", () => {
    const { totalAmount } = calculatePayrollTotal(base, { compensation_amount: 150 });
    expect(totalAmount).toBe(5150);
  });

  it("combines bonus and compensation", () => {
    const { totalAmount } = calculatePayrollTotal(base, { bonus: 200, compensation_amount: 100 });
    expect(totalAmount).toBe(5300);
  });

  it("rounds to 2 decimal places", () => {
    const record = { ...base, gross_salary: 1000, period: { working_days: 3 } };
    const { proratedGross } = calculatePayrollTotal(record, { days_worked: 1 });
    expect(proratedGross).toBe(333.33);
  });

  it("handles zero days worked", () => {
    const { proratedGross, totalAmount } = calculatePayrollTotal(base, { days_worked: 0 });
    expect(proratedGross).toBe(0);
    expect(totalAmount).toBe(0);
  });

  it("uses existing values when no updates provided", () => {
    const existing = { ...base, bonus: 500, compensation_amount: 200 };
    const { totalAmount } = calculatePayrollTotal(existing, {});
    expect(totalAmount).toBe(5700);
  });

  it("falls back to working_days=1 when period is null", () => {
    const noPeriod = { ...base, period: null, gross_salary: 3000, days_worked: 1 };
    const { proratedGross } = calculatePayrollTotal(noPeriod, {});
    expect(proratedGross).toBe(3000);
  });

  it("handles large salaries without precision loss", () => {
    const record = { ...base, gross_salary: 150000, period: { working_days: 20 } };
    const { proratedGross } = calculatePayrollTotal(record, { days_worked: 15 });
    expect(proratedGross).toBe(112500);
  });
});
