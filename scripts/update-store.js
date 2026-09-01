import fs from 'fs';

let content = fs.readFileSync('store/dataStore.ts', 'utf8');

// Normalize line endings to \n for easier matching
content = content.replace(/\r\n/g, '\n');

// 1. Add Decimal import
if (!content.includes("import Decimal")) {
    content = content.replace("import { create } from 'zustand';", "import { create } from 'zustand';\nimport Decimal from 'decimal.js';");
}
console.log("Replaced import");

// 2. Wrap addInvoice
content = content.replace(
    "addInvoice: async (invoice, checkData) => {\n    const state = get();",
    "addInvoice: async (invoice, checkData) => {\n    await DatabaseService.withTransaction(async () => {\n    const state = get();"
);
console.log("Wrapped addInvoice");

// 3. Replace balance calculations
content = content.replace(
    "const updatedCustomer = { ...customer, balance: customer.balance + invoiceEffect };",
    "const updatedCustomer = { ...customer, balance: new Decimal(customer.balance).plus(invoiceEffect).toNumber() };"
);
console.log("Replaced updatedCustomer balance");

content = content.replace(
    "updatedCustomer.balance += cashEffect;",
    "updatedCustomer.balance = new Decimal(updatedCustomer.balance).plus(cashEffect).toNumber();"
);
console.log("Replaced updatedCustomer cash balance");

content = content.replace(
    "balance: account.balance + (isIncome ? invoice.paidCashAmount : -invoice.paidCashAmount)",
    "balance: new Decimal(account.balance).plus(isIncome ? invoice.paidCashAmount : -invoice.paidCashAmount).toNumber()"
);
console.log("Replaced account balance");

const addInvoiceEndMatch = `    // Reload all data to ensure consistency
    await get().loadAllData();
  },

  updateInvoice:`;

const addInvoiceEndReplacement = `    // Selectively reload financials to avoid freezing
    const [products, customers, bankAccounts, invoices, customerTransactions, transactions, checks, logs, productHistory] = await Promise.all([
      DatabaseService.getAllProducts(),
      DatabaseService.getAllCustomers(),
      DatabaseService.getAllBankAccounts(),
      DatabaseService.getAllInvoices(),
      DatabaseService.getAllCustomerTransactions(),
      DatabaseService.getAllTransactions(),
      DatabaseService.getAllChecks(),
      DatabaseService.getAllSystemLogs(),
      DatabaseService.getAllProductHistory()
    ]);
    set({ products, customers, bankAccounts, invoices, customerTransactions, transactions, checks, logs, productHistory });
    });
  },

  updateInvoice:`;

content = content.replace(addInvoiceEndMatch, addInvoiceEndReplacement);
console.log("Replaced addInvoice generic reload");

fs.writeFileSync('store/dataStore.ts', content);
console.log("addInvoice updated successfully!");
