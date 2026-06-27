import type { PayrollEntry, Employee } from "../types";

export function generatePayslipHtml(
  employee: Employee,
  entry: PayrollEntry,
  periodLabel: string,
): string {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
  h1 { text-align: center; color: #1F5E3B; font-size: 18px; margin-bottom: 4px; }
  .subtitle { text-align: center; color: #666; font-size: 11px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  .total-row { font-weight: bold; background: #e8f5e9; }
  .right { text-align: right; }
  .signature { margin-top: 40px; display: flex; justify-content: space-between; }
  .signature div { text-align: center; width: 30%; border-top: 1px solid #333; padding-top: 4px; font-size: 10px; }
</style></head><body>
  <h1>Payslip</h1>
  <div class="subtitle">${periodLabel}</div>
  <table>
    <tr><td><strong>Employee:</strong> ${employee.name}</td><td><strong>Code:</strong> ${employee.code}</td></tr>
    <tr><td><strong>Designation:</strong> ${employee.designation}</td><td><strong>Working Days:</strong> ${entry.workingDays}</td></tr>
  </table>
  <table>
    <tr><th>Earnings</th><th class="right">Amount (NPR)</th></tr>
    <tr><td>Base Salary</td><td class="right">${entry.baseSalary.toFixed(2)}</td></tr>
    <tr><td>Gross Pay (pro-rata)</td><td class="right">${entry.grossPay.toFixed(2)}</td></tr>
  </table>
  <table>
    <tr><th>Deductions</th><th class="right">Amount (NPR)</th></tr>
    <tr><td>Tax (${employee.taxPercent}%)</td><td class="right">(${entry.taxDeduction.toFixed(2)})</td></tr>
    <tr><td>Provident Fund (${employee.pfPercent}%)</td><td class="right">(${entry.pfDeduction.toFixed(2)})</td></tr>
    ${entry.otherDeductions > 0 ? `<tr><td>Other Deductions</td><td class="right">(${entry.otherDeductions.toFixed(2)})</td></tr>` : ""}
    <tr class="total-row"><td>Net Pay</td><td class="right">NPR ${entry.netPay.toFixed(2)}</td></tr>
  </table>
  <div class="signature">
    <div>Employee Signature</div>
    <div>Prepared By</div>
    <div>Authorized By</div>
  </div>
</body></html>`;
}
