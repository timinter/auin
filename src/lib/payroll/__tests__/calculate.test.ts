import { describe, it, expect } from "vitest";
import { calculatePayrollTotal, PayrollFields } from "../calculate";

const base: PayrollFields & { period: { working_days: number } } = {
  days_worked: 22,
  gross_salary: 5000,
  bonus: 0,
  compensation_amount: 0,
  adjustment_amount: 0,
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

  it("adds positive adjustment to total", () => {
    const { totalAmount } = calculatePayrollTotal(base, { adjustment_amount: 200 });
    expect(totalAmount).toBe(5200);
  });

  it("subtracts negative adjustment from total", () => {
    const { totalAmount } = calculatePayrollTotal(base, { adjustment_amount: -300 });
    expect(totalAmount).toBe(4700);
  });

  it("combines all fields including adjustment", () => {
    const { totalAmount } = calculatePayrollTotal(base, {
      bonus: 100,
      compensation_amount: 50,
      adjustment_amount: -75,
    });
    // 5000 + 100 + 50 - 75 = 5075
    expect(totalAmount).toBe(5075);
  });

  it("uses actualWorkingDays override instead of period.working_days", () => {
    // period says 22, but actual is 20 (2 holidays)
    const { proratedGross } = calculatePayrollTotal(base, { days_worked: 20 }, 20);
    // 5000 / 20 * 20 = 5000 (full salary despite fewer days)
    expect(proratedGross).toBe(5000);
  });

  it("prorates correctly with holidays reducing working days", () => {
    // 22 period days, but 2 holidays → 20 actual working days
    // Employee took 2 leave days → 18 days worked
    const { proratedGross } = calculatePayrollTotal(base, { days_worked: 18 }, 20);
    // 5000 / 20 * 18 = 4500
    expect(proratedGross).toBe(4500);
  });

  it("without actualWorkingDays falls back to period.working_days", () => {
    const { proratedGross } = calculatePayrollTotal(base, { days_worked: 11 });
    // 5000 / 22 * 11 = 2500
    expect(proratedGross).toBe(2500);
  });
});
