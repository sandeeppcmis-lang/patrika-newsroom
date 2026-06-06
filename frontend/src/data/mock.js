// Demo data so the SPA is fully presentable before the PHP/MySQL backend is live.
// Replace by deploying backend/ — the api client will prefer live data automatically.

// The 28 columns are taken verbatim from edit_hr.xlsx and used as the HR schema.
export const HR_FIELDS = [
  { key: 'EMP_CODE',          label: 'Employee Code',    type: 'text' },
  { key: 'EMPNAME',           label: 'Employee Name',    type: 'text' },
  { key: 'Status',            label: 'Status',           type: 'text' },
  { key: 'emp_designation',   label: 'Designation',      type: 'text' },
  { key: 'emp_deptt',         label: 'Department',       type: 'text' },
  { key: 'profile',           label: 'Profile',          type: 'text' },
  { key: 'Story_Type',        label: 'Story Type',       type: 'text' },
  { key: 'Branch',            label: 'Branch',           type: 'text' },
  { key: 'bureau',            label: 'Bureau',           type: 'text' },
  { key: 'district',          label: 'District',         type: 'text' },
  { key: 'Location',          label: 'Location',         type: 'text' },
  { key: 'State',             label: 'State',            type: 'text' },
  { key: 'DOB',               label: 'Date of Birth',    type: 'text' },
  { key: 'DOJ',               label: 'Date of Joining',  type: 'text' },
  { key: 'pan_no',            label: 'PAN No.',          type: 'text' },
  { key: 'FATHER_NAME',       label: 'Father Name',      type: 'text' },
  { key: 'Email_ID',          label: 'Email',            type: 'text' },
  { key: 'Mob_No',            label: 'Mobile',           type: 'text' },
  { key: 'emp_qualification', label: 'Qualification',    type: 'text' },
  { key: 'gross_salary',      label: 'Gross Salary',     type: 'text' },
  { key: 'part_b',            label: 'Part B',           type: 'text' },
  { key: 'emp_pli',           label: 'PLI',              type: 'text' },
  { key: 'other_allowance',   label: 'Other Allowance',  type: 'text' },
  { key: 'g_total',           label: 'Grand Total',      type: 'number' },
  { key: 'is_top_team',       label: 'Top Team',         type: 'number' },
  { key: 'is_qc_team',        label: 'QC Team',          type: 'number' },
  { key: 'is_data_team',      label: 'Data Team',        type: 'number' },
  { key: 'is_tv_multi_team',  label: 'TV/Multi Team',    type: 'number' },
  { key: 'address',           label: 'Address',          type: 'text' },
  { key: 'mobile_device',     label: 'Mobile Device',    type: 'text' },
];

const emp = (id, code, name, desig, deptt, branch, location, dob, salary, pli, qual) => ({
  id, EMP_CODE: code, EMPNAME: name, Status: 'Active', is_emp_working: 1,
  emp_designation: desig, emp_deptt: deptt, Branch: branch, Location: location,
  State: 'Rajasthan', bureau: branch, district: location, profile: desig,
  DOB: dob, DOJ: '01-01-2010', pan_no: 'ABCPK' + (1000 + id) + 'L',
  Email_ID: name.toLowerCase().replace(' ', '.') + '@patrika.com',
  Mob_No: '98' + String(1000000 + id * 7).padStart(8, '0'),
  emp_qualification: qual, gross_salary: String(salary),
  emp_pli: String(pli), other_allowance: '2000', part_b: '3000',
  g_total: salary + pli + 2000 + 3000,
  is_top_team: 0, is_qc_team: 0, is_data_team: 0, is_tv_multi_team: 0,
  is_other_team: '', Story_Type: 'General', address: location, mobile_device: 'Android',
});

export const mock = {
  dashboard: (edition) => ({
    edition,
    kpis: {
      pages: 184, delayed: 3, productivity: 86, quality: 'A',
      adratio: 38, legal: 7, hr: 5
    },
    qualityTrend: [
      { day: 'Mon', score: 78 }, { day: 'Tue', score: 82 }, { day: 'Wed', score: 80 },
      { day: 'Thu', score: 85 }, { day: 'Fri', score: 88 }, { day: 'Sat', score: 84 },
      { day: 'Sun', score: 90 }
    ],
    editionDelays: [
      { edition: 'Jaipur', delay: 12 }, { edition: 'Jodhpur', delay: 45 },
      { edition: 'Udaipur', delay: 8 }, { edition: 'Kota', delay: 22 },
      { edition: 'Bhopal', delay: 5 }, { edition: 'Indore', delay: 30 }
    ],
    deptShare: [
      { name: 'Front Page', value: 18 }, { name: 'City', value: 26 },
      { name: 'Sports', value: 14 }, { name: 'Business', value: 11 },
      { name: 'Entertainment', value: 16 }, { name: 'Editorial', value: 15 }
    ]
  }),
  editorial: {
    columns: ['Breaking', 'Exclusive', 'Follow-up', 'Investigative'],
    stories: [
      { id: 1, title: 'Assembly session live coverage', reporter: 'R. Sharma', priority: 'Breaking', status: 'Assigned' },
      { id: 2, title: 'Water crisis ground report', reporter: 'M. Verma', priority: 'Investigative', status: 'In Progress' },
      { id: 3, title: 'Exclusive: Metro phase-2 plan', reporter: 'P. Jain', priority: 'Exclusive', status: 'Approved' },
      { id: 4, title: 'Follow-up: school fee hike', reporter: 'S. Nair', priority: 'Follow-up', status: 'Draft' }
    ],
    trending: ['#RajasthanBudget', 'Monsoon forecast', 'IPL auction', 'Ambedkar Jayanti', 'Metro Phase 2']
  },
  production: {
    stages: [
      { stage: 'Page Open', target: '20:00', actual: '20:10', status: 'ok' },
      { stage: 'Editing Done', target: '22:30', actual: '22:55', status: 'warn' },
      { stage: 'PDF Export', target: '23:15', actual: '23:40', status: 'warn' },
      { stage: 'Plate Release', target: '23:45', actual: '00:30', status: 'late' },
      { stage: 'Printing', target: '00:30', actual: '01:05', status: 'late' }
    ],
    heatmap: ['City', 'Sports', 'Front', 'Biz', 'Edit'].map((d) => ({
      dept: d, values: Array.from({ length: 7 }, () => Math.round(Math.random() * 50))
    })),
    prediction: { risk: 'High', message: 'Plate release likely to breach SLA by ~35 min based on last 14 days.' }
  },
  pages: {
    byPerson: [
      { name: 'R. Sharma', role: 'Reporter', stories: 42, front: 6, exclusive: 4, avgSize: 540 },
      { name: 'M. Verma', role: 'Reporter', stories: 38, front: 3, exclusive: 7, avgSize: 610 },
      { name: 'A. Khan', role: 'Desk Editor', stories: 51, front: 9, exclusive: 2, avgSize: 480 },
      { name: 'P. Jain', role: 'Page Editor', stories: 29, front: 11, exclusive: 5, avgSize: 720 }
    ],
    epaper: { adRatio: 38, newsRatio: 62, colorPages: 8, layoutBalance: 'Slightly ad-heavy on p.3' }
  },
  employees: [
    emp(1,'PK1001','Rajesh Sharma', 'Senior Reporter','Editorial','Jaipur', 'Jaipur', '15-03-1966',62000,5000,'MA Journalism'),
    emp(2,'PK1002','Meena Verma',   'Reporter',       'Editorial','Jodhpur','Jodhpur','22-07-1990',48000,3500,'BA'),
    emp(3,'PK1003','Arif Khan',     'Desk Editor',    'Desk',     'Jaipur', 'Jaipur', '11-11-1977',78000,6000,'MA'),
    emp(4,'PK1004','Priya Jain',    'Page Editor',    'Production','Udaipur','Udaipur','05-06-1974',81000,7000,'BA'),
    emp(5,'PK1005','Sunil Nair',    'Sub Editor',     'Desk',     'Kota',   'Kota',   '30-09-1995',44000,2500,'MA'),
    emp(6,'PK1006','Kavita Rao',    'Bureau Chief',   'Bureau',   'Bhopal', 'Bhopal', '28-06-1966',105000,9000,'MBA'),
    emp(7,'PK1007','Deepak Soni',   'Photographer',   'Photo',    'Indore', 'Indore', '19-04-1983',39000,2000,'Diploma'),
    emp(8,'PK1008','Anita Das',     'Reporter',       'Editorial','Raipur', 'Raipur', '03-01-1963',53000,4000,'MA'),
  ],
  retirements: [
    { EMP_CODE:'PK1006', EMPNAME:'Kavita Rao',    emp_deptt:'Bureau',    Branch:'Bhopal',  DOB:'28-06-1966', retireOn:'2026-06-28', window:'This month' },
    { EMP_CODE:'PK1001', EMPNAME:'Rajesh Sharma', emp_deptt:'Editorial', Branch:'Jaipur',  DOB:'15-03-1966', retireOn:'2026-03-15', window:'Overdue' },
    { EMP_CODE:'PK1008', EMPNAME:'Anita Das',     emp_deptt:'Editorial', Branch:'Raipur',  DOB:'03-01-1963', retireOn:'2023-01-03', window:'Overdue' },
  ],
  legal: [
    { case_no: 'CIV/2025/118', edition: 'Jaipur', court: 'Rajasthan HC', party: 'State vs Patrika', hearing: '2026-05-28', status: 'Active', risk: 'High', advocate: 'Adv. S. Mehta' },
    { case_no: 'DEF/2024/77', edition: 'Kota', court: 'District Court', party: 'XYZ Builders', hearing: '2026-06-04', status: 'Pending Docs', risk: 'Medium', advocate: 'Adv. R. Gupta' },
    { case_no: 'CIV/2026/04', edition: 'Indore', court: 'MP HC', party: 'ABC Trust', hearing: '2026-05-22', status: 'Active', risk: 'Low', advocate: 'Adv. N. Iyer' }
  ],
  alerts: [
    { id: 1, type: 'Production', sev: 'high', text: 'Jaipur edition page 1 not closed till 23:30', time: '2m ago' },
    { id: 2, type: 'Legal', sev: 'high', text: 'High-risk hearing CIV/2025/118 in 8 days', time: '1h ago' },
    { id: 3, type: 'HR', sev: 'med', text: 'Kavita Rao retiring this month — plan replacement', time: '3h ago' },
    { id: 4, type: 'Content', sev: 'med', text: 'Fake-news probability high on submitted story #4412', time: '4h ago' },
    { id: 5, type: 'Calendar', sev: 'low', text: 'Tomorrow: Ambedkar Jayanti special edition', time: '6h ago' }
  ],
  reports: [
    { name: 'Edition Performance', desc: 'Pages, delays, quality by edition', formats: ['PDF', 'Excel'] },
    { name: 'Employee Performance', desc: 'Productivity & appreciation timeline', formats: ['PDF', 'Excel'] },
    { name: 'Printing Efficiency', desc: 'SLA breach & bottleneck analysis', formats: ['PDF', 'Excel'] },
    { name: 'Content Quality', desc: 'Grades, sentiment, legal-risk words', formats: ['PDF', 'Excel'] },
    { name: 'Advertisement Analytics', desc: 'Ad vs news ratio, revenue ratio', formats: ['PDF', 'Excel'] }
  ],
  aiAnswer: (q) => ({
    answer: `Demo response (connect ai-service for live AI). You asked: “${q}”. ` +
      `Today 3 editions are delayed (Jodhpur worst at 45 min). A. Khan leads front-page stories (9). ` +
      `2 stories are flagged low-quality. Jaipur has 1 high-risk legal case.`,
    suggestions: ['Show delayed editions today', 'Top front-page reporter', 'Low-quality content list', 'Legal cases for Jaipur']
  })
};
