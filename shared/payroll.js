// Payroll engine (Pakistan, monthly PKR). Turns an employee's monthly gross salary
// (`employees.gross_salary`) plus the month's derived attendance into a payslip.
import { computeRange, summarizeDays } from './attendance.js';
import { monthDates } from './dates.js';

export const DEFAULT_PAYROLL_SETTINGS = {
  basicPct: 60,
  houseRentPct: 30,
  utilityPct: 10,
  standardMonthlyHours: 176, // 22 working days × 8 h — basis for the hourly overtime rate
  overtimeMultiplier: 1.5,
  offDayMultiplier: 2.0,
  latesPerHalfDay: 3, // every N late arrivals = 0.5 day loss of pay
  eobiEmployee: 370, // 1% of minimum wage (PKR 37,000), per month
  eobiEmployer: 1850, // 5% of minimum wage
  providentFundPct: 0, // employee PF, % of basic (0 = no PF)
  employerPfPct: 0,
  // FBR salaried-individual slabs on annual taxable income (Finance Act 2025, tax year 2026). Editable.
  taxBrackets: [
    { upTo: 600000, rate: 0 },
    { upTo: 1200000, rate: 1 },
    { upTo: 2200000, rate: 11 },
    { upTo: 3200000, rate: 23 },
    { upTo: 4100000, rate: 30 },
    { upTo: null, rate: 35 },
  ],
};

const r2 = (n) => Math.round(n * 100) / 100;

export const annualIncomeTax = (annualTaxable, brackets) => {
  let tax = 0;
  let lower = 0;
  for (const b of brackets) {
    const upper = b.upTo ?? Infinity;
    if (annualTaxable <= lower) break;
    tax += (Math.min(annualTaxable, upper) - lower) * (b.rate / 100);
    lower = upper;
  }
  return tax;
};

export const computePayslip = (emp, monthKey, ctx, settings) => {
  const s = { ...DEFAULT_PAYROLL_SETTINGS, ...settings };
  const days = computeRange(emp, monthDates(monthKey), ctx);
  const att = summarizeDays(days);

  const monthlyGross = Number(emp.grossSalary) || 0;
  const basic = monthlyGross * (s.basicPct / 100);
  const houseRent = monthlyGross * (s.houseRentPct / 100);
  const utility = monthlyGross * (s.utilityPct / 100);

  const workingDays = Math.max(1, att.workingDays);
  const perDay = monthlyGross / workingDays;
  const hourly = monthlyGross / s.standardMonthlyHours;

  const latePenaltyDays = Math.floor(att.late / s.latesPerHalfDay) * 0.5;
  const lopDays = Math.min(workingDays, att.absent + att.unpaidLeave + att.notEmployed + att.halfDay * 0.5 + latePenaltyDays);
  const lop = perDay * lopDays;

  const offDayOtMin = days.filter((d) => d.status === 'OFF_DAY_WORK').reduce((a, d) => a + d.overtimeMinutes, 0);
  const regularOtMin = att.overtimeMinutes - offDayOtMin;
  const overtimePay =
    hourly * s.overtimeMultiplier * (regularOtMin / 60) + hourly * s.offDayMultiplier * (offDayOtMin / 60);

  const grossEarnings = Math.max(0, monthlyGross - lop + overtimePay);
  const payableRatio = (workingDays - lopDays) / workingDays;

  const pf = basic * payableRatio * (s.providentFundPct / 100);
  const eobi = monthlyGross > 0 ? s.eobiEmployee : 0;
  const incomeTax = Math.max(0, annualIncomeTax(grossEarnings * 12, s.taxBrackets) / 12);

  const earnings = [
    { label: 'Basic Salary', amount: r2(basic) },
    { label: 'House Rent Allowance', amount: r2(houseRent) },
    { label: 'Utility Allowance', amount: r2(utility) },
    { label: `Overtime (${((regularOtMin + offDayOtMin) / 60).toFixed(2)} h)`, amount: r2(overtimePay) },
    { label: `Loss of Pay (${lopDays} day${lopDays === 1 ? '' : 's'})`, amount: r2(-lop) },
  ];
  const deductions = [
    { label: 'Income Tax (FBR)', amount: r2(incomeTax), group: 'Tax' },
    { label: 'EOBI (Employee)', amount: r2(eobi), group: 'Statutory' },
    { label: `Provident Fund (${s.providentFundPct}%)`, amount: r2(pf), group: 'Benefit' },
  ];
  const totalDeductions = deductions.reduce((a, d) => a + d.amount, 0);
  const employerContributions = [
    { label: 'EOBI (Employer)', amount: r2(monthlyGross > 0 ? s.eobiEmployer : 0) },
    { label: `Provident Fund — Employer (${s.employerPfPct}%)`, amount: r2(basic * payableRatio * (s.employerPfPct / 100)) },
  ];
  const employerTotal = employerContributions.reduce((a, d) => a + d.amount, 0);

  return {
    empId: emp.empId,
    name: emp.name,
    department: emp.department,
    designation: emp.designation,
    cnic: emp.cnic || '',
    bank: emp.bank?.accountNumber ? { bankName: emp.bank.bankName, accountLast4: emp.bank.accountNumber.slice(-4) } : null,
    monthKey,
    monthlySalary: monthlyGross,
    attendance: {
      workingDays: att.workingDays,
      present: att.present,
      late: att.late,
      halfDay: att.halfDay,
      absent: att.absent,
      missedPunch: att.missedPunch,
      paidLeave: att.paidLeave,
      unpaidLeave: att.unpaidLeave,
      holidays: att.holidays,
      workedHours: r2(att.workedMinutes / 60),
      overtimeHours: r2(att.overtimeMinutes / 60),
      lopDays,
      latePenaltyDays,
    },
    earnings,
    deductions,
    employerContributions,
    grossEarnings: r2(grossEarnings),
    totalDeductions: r2(totalDeductions),
    taxTotal: r2(incomeTax),
    netPay: r2(grossEarnings - totalDeductions),
    employerCost: r2(grossEarnings + employerTotal),
  };
};

export const computePayrollRun = (employees, monthKey, ctx, settings) =>
  employees.filter((e) => e.active !== false).map((e) => computePayslip(e, monthKey, ctx, settings));
