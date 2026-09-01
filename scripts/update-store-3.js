import fs from 'fs';

let content = fs.readFileSync('store/dataStore.ts', 'utf8');

// Normalize line endings to \n
content = content.replace(/\r\n/g, '\n');

// Wrap deleteInvoice
const deleteInvoiceStartMatch = `  deleteInvoice: async (id) => {\n    const invoice = get().invoices.find(inv => inv.id === id);`;
const deleteInvoiceStartReplacement = `  deleteInvoice: async (id) => {\n    await DatabaseService.withTransaction(async () => {\n    const invoice = get().invoices.find(inv => inv.id === id);`;
content = content.replace(deleteInvoiceStartMatch, deleteInvoiceStartReplacement);

// deleteInvoice: balance recalculations
content = content.replace(
    "const updatedCustomer = { ...customer, balance: customer.balance + balanceAdjustment };",
    "const updatedCustomer = { ...customer, balance: new Decimal(customer.balance).plus(balanceAdjustment).toNumber() };"
);

content = content.replace(
    "const updatedAccount = { ...account, balance: account.balance + reverseAmount };",
    "const updatedAccount = { ...account, balance: new Decimal(account.balance).plus(reverseAmount).toNumber() };"
);

// deleteInvoice: end processing
const deleteInvoiceEndMatch = `    console.log('✅ [END] Invoice deleted successfully');

    // 7. Reload data
    await get().loadAllData();
  },

  deleteTransaction:`;

const deleteInvoiceEndReplacement = `    console.log('✅ [END] Invoice deleted successfully');

    // 7. Selectively reload financials to avoid freezing
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

  deleteTransaction:`;

content = content.replace(deleteInvoiceEndMatch, deleteInvoiceEndReplacement);

fs.writeFileSync('store/dataStore.ts', content);
console.log("deleteInvoice updated successfully!");
