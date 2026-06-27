import type { Employee, PayrollEntry } from "../types";

function workingDaysInPeriod(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export function calculatePayrollEntries(
  employees: Employee[],
  periodStart: Date,
  periodEnd: Date,
): PayrollEntry[] {
  const entries: PayrollEntry[] = [];
  const totalWorkingDays = workingDaysInPeriod(periodStart, periodEnd);
  const totalCalendarDays = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  for (const emp of employees) {
    if (!emp.isActive) continue;

    const joinedAt = new Date(emp.joinedAt.seconds * 1000);
    if (joinedAt > periodEnd) continue;

    const actualStart = joinedAt > periodStart ? joinedAt : periodStart;
    const workingDays = workingDaysInPeriod(actualStart, periodEnd);
    const daysRatio = totalCalendarDays > 0 ? workingDays / totalWorkingDays : 1;

    const grossPay = Math.round(emp.baseSalary * daysRatio * 100) / 100;
    const taxDeduction = Math.round(grossPay * (emp.taxPercent / 100) * 100) / 100;
    const pfDeduction = Math.round(grossPay * (emp.pfPercent / 100) * 100) / 100;
    const netPay = Math.round((grossPay - taxDeduction - pfDeduction) * 100) / 100;

    entries.push({
      employeeId: emp.id,
      employeeName: emp.name,
      baseSalary: emp.baseSalary,
      workingDays,
      grossPay,
      taxDeduction,
      pfDeduction,
      otherDeductions: 0,
      netPay,
    });
  }

  return entries;
}
