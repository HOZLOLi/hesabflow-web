import fs from 'fs';

let content = fs.readFileSync('store/dataStore.ts', 'utf8');

// Normalize line endings to \n
content = content.replace(/\r\n/g, '\n');

// Wrap updateInvoice
content = content.replace(
    "updateInvoice: async (invoice) => {\n    console.log('🔵 [START] Updating invoice:', invoice.number);\n\n    const oldInvoice = get().invoices.find(inv => inv.id === invoice.id);",
    "updateInvoice: async (invoice) => {\n    await DatabaseService.withTransaction(async () => {\n    console.log('🔵 [START] Updating invoice:', invoice.number);\n\n    const oldInvoice = get().invoices.find(inv => inv.id === invoice.id);"
);

// updateInvoice: balance recalculations
content = content.replace(
    "const updatedCustomer = { ...customer, balance: customer.balance + balanceAdjustment };\n          await DatabaseService.updateCustomer(updatedCustomer);",
    "const updatedCustomer = { ...customer, balance: new Decimal(customer.balance).plus(balanceAdjustment).toNumber() };\n          await DatabaseService.updateCustomer(updatedCustomer);"
);

content = content.replace(
    "const updatedAccount = { ...account, balance: account.balance + reverseAmount };\n            await DatabaseService.updateBankAccount(updatedAccount);",
    "const updatedAccount = { ...account, balance: new Decimal(account.balance).plus(reverseAmount).toNumber() };\n            await DatabaseService.updateBankAccount(updatedAccount);"
);

content = content.replace(
    "const updatedCustomer = { ...customer, balance: customer.balance + invoiceEffect };\n\n          // Handle cash payment",
    "const updatedCustomer = { ...customer, balance: new Decimal(customer.balance).plus(invoiceEffect).toNumber() };\n\n          // Handle cash payment"
);

content = content.replace(
    "updatedCustomer.balance += cashEffect;",
    "updatedCustomer.balance = new Decimal(updatedCustomer.balance).plus(cashEffect).toNumber();"
);

content = content.replace(
    "const updatedAccount = {\n                  ...account,\n                  balance: account.balance + (isIncome ? invoice.paidCashAmount : -invoice.paidCashAmount)\n                };",
    "const updatedAccount = {\n                  ...account,\n                  balance: new Decimal(account.balance).plus(isIncome ? invoice.paidCashAmount : -invoice.paidCashAmount).toNumber()\n                };"
);

// updateInvoice end (loadAllData)
const updateInvoiceEndMatch = `    console.log('✅ [END] Invoice updated with full side-effect recalculation');

    await get().loadAllData();
  },

  deleteInvoice:`;

const updateInvoiceEndReplacement = `    console.log('✅ [END] Invoice updated with full side-effect recalculation');

    // Selectively reload financials to avoid freezing
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

  deleteInvoice:`;

content = content.replace(updateInvoiceEndMatch, updateInvoiceEndReplacement);

fs.writeFileSync('store/dataStore.ts', content);
console.log("updateInvoice updated successfully!");
