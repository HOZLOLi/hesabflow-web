import * as XLSX from 'xlsx';

// Sample test data matching the Customer Cardex format
const testData = [
    { row: 1, date: '1404/12/01', time: '10:30', type: 'تراز', desc: 'تراز اولیه حساب', debtor: 5000000, creditor: 0, balance: 5000000 },
    { row: 2, date: '1404/12/03', time: '11:15', type: 'فاکتور', desc: 'فاکتور فروش شماره 1024 - لوازم الکتریکی', debtor: 12500000, creditor: 0, balance: 17500000 },
    { row: 3, date: '1404/12/05', time: '09:00', type: 'نقد', desc: 'دریافت نقدی بابت فاکتور 1024', debtor: 0, creditor: 8000000, balance: 9500000 },
    { row: 4, date: '1404/12/07', time: '14:20', type: 'چک', desc: 'دریافت چک شماره 543210 - بانک ملت', debtor: 0, creditor: 4500000, balance: 5000000 },
    { row: 5, date: '1404/12/10', time: '16:45', type: 'فاکتور', desc: 'فاکتور فروش شماره 1031 - قطعات کامپیوتر', debtor: 8750000, creditor: 0, balance: 13750000 },
    { row: 6, date: '1404/12/12', time: '10:00', type: 'مرجوعی', desc: 'مرجوعی فاکتور 1024 - یک قلم برگشتی', debtor: 0, creditor: 2500000, balance: 11250000 },
    { row: 7, date: '1404/12/15', time: '13:30', type: 'نقد', desc: 'دریافت نقدی بابت فاکتور 1031', debtor: 0, creditor: 5000000, balance: 6250000 },
    { row: 8, date: '1404/12/18', time: '11:00', type: 'فاکتور', desc: 'فاکتور فروش شماره 1045 - لوازم خانگی', debtor: 15000000, creditor: 0, balance: 21250000 },
    { row: 9, date: '1404/12/20', time: '09:45', type: 'چک', desc: 'دریافت چک شماره 678901 - بانک صادرات', debtor: 0, creditor: 10000000, balance: 11250000 },
    { row: 10, date: '1404/12/22', time: '15:10', type: 'نقد', desc: 'دریافت نقدی - تسویه جزئی', debtor: 0, creditor: 3000000, balance: 8250000 },
    { row: 11, date: '1404/12/25', time: '12:00', type: 'فاکتور', desc: 'فاکتور فروش شماره 1052 - تجهیزات صنعتی', debtor: 22000000, creditor: 0, balance: 30250000 },
    { row: 12, date: '1404/12/27', time: '10:30', type: 'نقد', desc: 'دریافت نقدی بابت فاکتور 1052', debtor: 0, creditor: 12000000, balance: 18250000 },
    { row: 13, date: '1404/12/28', time: '14:00', type: 'چک', desc: 'دریافت چک شماره 912345 - بانک ملی', debtor: 0, creditor: 8000000, balance: 10250000 },
    { row: 14, date: '1404/12/29', time: '16:00', type: 'انتقال', desc: 'واریز بانکی - حواله شماره 456', debtor: 0, creditor: 5000000, balance: 5250000 },
    { row: 15, date: '1404/12/30', time: '17:30', type: 'فاکتور', desc: 'فاکتور فروش شماره 1060 - قطعات یدکی', debtor: 9500000, creditor: 0, balance: 14750000 },
];

const totalDebtor = testData.reduce((sum, r) => sum + r.debtor, 0);
const totalCreditor = testData.reduce((sum, r) => sum + r.creditor, 0);
const finalBalance = testData[testData.length - 1].balance;

// Build Excel rows
const rows = testData.map(r => ({
    'ردیف': r.row,
    'تاریخ': r.date,
    'ساعت': r.time,
    'نوع': r.type,
    'شرح': r.desc,
    'بدهکار': r.debtor || 0,
    'بستانکار': r.creditor || 0,
    'مانده': r.balance,
}));

// Summary row
rows.push({
    'ردیف': '',
    'تاریخ': '',
    'ساعت': '',
    'نوع': '',
    'شرح': 'جمع کل',
    'بدهکار': totalDebtor,
    'بستانکار': totalCreditor,
    'مانده': finalBalance,
});

const ws = XLSX.utils.json_to_sheet(rows);
ws['!cols'] = [
    { wch: 6 }, { wch: 14 }, { wch: 8 }, { wch: 10 },
    { wch: 45 }, { wch: 16 }, { wch: 16 }, { wch: 16 }
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'کاردکس');
XLSX.writeFile(wb, 'd:/hesabflow/test_cardex_output.xlsx');

console.log('✅ Excel file created: test_cardex_output.xlsx');
console.log(`   Total rows: ${testData.length}`);
console.log(`   Total debtor: ${totalDebtor.toLocaleString()}`);
console.log(`   Total creditor: ${totalCreditor.toLocaleString()}`);
console.log(`   Final balance: ${finalBalance.toLocaleString()}`);
