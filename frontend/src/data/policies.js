// Company policy library shown in Employee Self-Service. Acknowledgements are stored in `policy_ack`.
export const POLICIES = [
  {
    id: 'pol-attendance', title: 'Attendance & Working Hours Policy', category: 'Time & Attendance', version: '1.0', effective: '2026-01-01',
    summary: 'Schedules, late and half-day rules, check-in methods, breaks and corrections.',
    sections: [
      { heading: 'Working hours', body: 'Working hours follow the schedule assigned to your designation (reporting time to normal out time), Monday to Friday, with a 60-minute break.' },
      { heading: 'Late arrival', body: 'Checking in after the "late after" time of your schedule is marked Late. Every 3 late arrivals in a pay month result in a 0.5 day deduction.' },
      { heading: 'Half day', body: 'Checking in after the "half day after" time of your schedule, or working less than half the standard hours, is recorded as a Half Day (0.5 day deduction).' },
      { heading: 'Check-in methods', body: 'Check in using the office biometric terminal, the GPS-verified mobile check-in (within 250 m of the office) or web check-in when remote work is approved. GPS check-ins outside the office radius are flagged for review.' },
      { heading: 'Corrections', body: 'Missed or incorrect punches must be corrected within 5 working days through Self-Service with a valid reason. Corrections are approved by HR or your department head.' },
    ],
  },
  {
    id: 'pol-leave', title: 'Leave Policy', category: 'Leave', version: '1.0', effective: '2026-01-01',
    summary: 'Leave entitlements, probation rules and approval workflow.',
    sections: [
      { heading: 'Entitlements', body: 'Entitlements are defined per leave type (annual limit, grant method). Some leave types are only available after confirmation (probation completed).' },
      { heading: 'Unpaid leave', body: 'Unpaid leave is deducted from salary at the daily rate (monthly gross ÷ working days in the month).' },
      { heading: 'Approval', body: 'Leave requests are submitted through Self-Service and approved by HR. Sick leave longer than 2 consecutive days requires a medical certificate.' },
    ],
  },
  {
    id: 'pol-payroll', title: 'Payroll & Deductions Policy', category: 'Payroll', version: '1.0', effective: '2026-01-01',
    summary: 'Pay cycle, salary structure, overtime, income tax and EOBI.',
    sections: [
      { heading: 'Pay cycle', body: 'Salaries are processed monthly. Payslips are published in Self-Service once payroll for the month is finalized.' },
      { heading: 'Salary structure', body: 'Monthly gross salary is split into Basic (60%), House Rent Allowance (30%) and Utility Allowance (10%).' },
      { heading: 'Overtime', body: 'Time beyond standard daily hours is paid in completed 15-minute blocks at 1.5x the hourly rate; work on off days and holidays at 2.0x.' },
      { heading: 'Deductions', body: 'Income tax is withheld per FBR salaried-individual slabs. EOBI employee contribution is deducted as notified. Loss of pay applies for absences, unpaid leave, half days and repeated late arrivals.' },
    ],
  },
  {
    id: 'pol-conduct', title: 'Code of Conduct', category: 'General', version: '1.0', effective: '2026-01-01',
    summary: 'Professional behaviour, harassment and conflicts of interest.',
    sections: [
      { heading: 'Respect at work', body: 'Treat colleagues, clients and partners with respect. Harassment of any kind is not tolerated (Protection against Harassment of Women at the Workplace Act, 2010).' },
      { heading: 'Conflicts of interest', body: 'Disclose outside employment or financial interests that could conflict with company duties.' },
    ],
  },
  {
    id: 'pol-data', title: 'HR Data & Privacy Policy', category: 'Compliance', version: '1.0', effective: '2026-01-01',
    summary: 'How personnel data is stored and who can access it.',
    sections: [
      { heading: 'Access control', body: 'Employees see only their own records. Department heads see attendance only. Full personnel, salary and payroll data is restricted to HR.' },
      { heading: 'Your rights', body: 'You can view and update your personal information through Self-Service. All changes are recorded in the audit log.' },
    ],
  },
];
