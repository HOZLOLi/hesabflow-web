import fs from 'fs';

let content = fs.readFileSync('store/dataStore.ts', 'utf8');

// Normalize line endings to \n
content = content.replace(/\r\n/g, '\n');

// Wrap deleteTransaction with transactions and replace logic
const deleteTransactionStartMatch = `  deleteTransaction: async (id) => {\n    const transaction = get().transactions.find(t => t.id === id);`;
const deleteTransactionStartReplacement = `  deleteTransaction: async (id) => {\n    await DatabaseService.withTransaction(async () => {\n    const transaction = get().transactions.find(t => t.id === id);`;
content = content.replace(deleteTransactionStartMatch, deleteTransactionStartReplacement);

content = content.replace(
    "const updatedSource = { ...sourceAccount, balance: sourceAccount.balance + transaction.amount };",
    "const updatedSource = { ...sourceAccount, balance: new Decimal(sourceAccount.balance).plus(transaction.amount).toNumber() };"
);

content = content.replace(
    "const updatedDest = { ...destAccount, balance: destAccount.balance - transaction.amount };",
    "const updatedDest = { ...destAccount, balance: new Decimal(destAccount.balance).minus(transaction.amount).toNumber() };"
);

content = content.replace(
    "const updatedAccount = { ...account, balance: account.balance + reverseAmount };\n        await DatabaseService.updateBankAccount(updatedAccount);",
    "const updatedAccount = { ...account, balance: new Decimal(account.balance).plus(reverseAmount).toNumber() };\n        await DatabaseService.updateBankAccount(updatedAccount);"
);

content = content.replace(
    "const updatedCustomer = { ...customer, balance: customer.balance + reverseEffect };",
    "const updatedCustomer = { ...customer, balance: new Decimal(customer.balance).plus(reverseEffect).toNumber() };"
);

const deleteTransactionEndMatch = `    console.log('✅ [END] Transaction deleted successfully');

    // 5. Reload data
    await get().loadAllData();
  },

  // ==================== PRODUCTIONS ====================`;

const deleteTransactionEndReplacement = `    console.log('✅ [END] Transaction deleted successfully');

    // 5. Selectively reload financials to avoid freezing
    const [customers, bankAccounts, customerTransactions, transactions, logs] = await Promise.all([
      DatabaseService.getAllCustomers(),
      DatabaseService.getAllBankAccounts(),
      DatabaseService.getAllCustomerTransactions(),
      DatabaseService.getAllTransactions(),
      DatabaseService.getAllSystemLogs()
    ]);
    set({ customers, bankAccounts, customerTransactions, transactions, logs });
    });
  },

  // ==================== PRODUCTIONS ====================`;

content = content.replace(deleteTransactionEndMatch, deleteTransactionEndReplacement);

fs.writeFileSync('store/dataStore.ts', content);
console.log("deleteTransaction updated successfully!");
