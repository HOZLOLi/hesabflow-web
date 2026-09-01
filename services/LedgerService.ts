import { moneySum, moneyAdd } from '../utils/money';
import type { Customer, CustomerTransaction, BankAccount, Transaction, Product, InventoryMovement } from '../types';

export interface BalanceDiscrepancy {
  id: string;
  name: string;
  storedBalance: number;
  derivedBalance: number;
  diff: number; // derivedBalance - storedBalance  (positive = stored is too low)
}

export interface StockDiscrepancy {
  id: string;
  name: string;
  storedStock: number;
  derivedStock: number;
  diff: number;
}

/**
 * Derives a customer's correct balance purely from their transaction history.
 * Source of truth: customer_transactions table.
 * Formula: SUM(isDebtor ? +amount : -amount)
 */
export function deriveCustomerBalance(transactions: CustomerTransaction[]): number {
  return moneySum(transactions.map(t => (t.isDebtor ? t.amount : -t.amount)));
}

/**
 * Derives a bank account's correct balance from its opening balance + all transactions.
 * Source of truth: bank_accounts.openingBalance + transactions table.
 */
export function deriveBankBalance(
  accountId: string,
  openingBalance: number,
  transactions: Transaction[],
): number {
  const effects = transactions
    .filter(t => t.accountId === accountId || t.toAccountId === accountId)
    .map(t => {
      if (t.type === 'income'   && t.accountId   === accountId) return  t.amount;
      if (t.type === 'expense'  && t.accountId   === accountId) return -t.amount;
      if (t.type === 'transfer' && t.accountId   === accountId) return -t.amount; // money out
      if (t.type === 'transfer' && t.toAccountId === accountId) return  t.amount; // money in
      return 0;
    });
  return moneyAdd(openingBalance, moneySum(effects));
}

/**
 * Derives a product's correct stock from its inventory movement history.
 * Source of truth: inventory_movements table.
 * Formula: SUM(quantityChange)
 */
export function deriveProductStock(movements: InventoryMovement[]): number {
  return moneySum(movements.map(m => m.quantityChange));
}

/**
 * Compares stored vs derived balances for all customers.
 * Returns only those with a discrepancy (empty array = all clean).
 */
export function reconcileCustomerBalances(
  customers: Customer[],
  allTransactions: CustomerTransaction[],
): BalanceDiscrepancy[] {
  return customers.reduce<BalanceDiscrepancy[]>((acc, customer) => {
    const trxs = allTransactions.filter(t => t.customerId === customer.id);
    const derived = deriveCustomerBalance(trxs);
    if (Math.abs(derived - customer.balance) > 0.001) {
      acc.push({ id: customer.id, name: customer.name, storedBalance: customer.balance, derivedBalance: derived, diff: derived - customer.balance });
    }
    return acc;
  }, []);
}

/**
 * Compares stored vs derived balances for all bank accounts.
 * Returns only those with a discrepancy.
 */
export function reconcileBankBalances(
  accounts: BankAccount[],
  allTransactions: Transaction[],
): BalanceDiscrepancy[] {
  return accounts.reduce<BalanceDiscrepancy[]>((acc, account) => {
    const derived = deriveBankBalance(account.id, account.openingBalance ?? 0, allTransactions);
    if (Math.abs(derived - account.balance) > 0.001) {
      acc.push({ id: account.id, name: account.title, storedBalance: account.balance, derivedBalance: derived, diff: derived - account.balance });
    }
    return acc;
  }, []);
}

/**
 * Compares stored vs derived stock for all products.
 * Returns only those with a discrepancy.
 */
export function reconcileProductStocks(
  products: Product[],
  allMovements: InventoryMovement[],
): StockDiscrepancy[] {
  return products.reduce<StockDiscrepancy[]>((acc, product) => {
    const movements = allMovements.filter(m => m.productId === product.id);
    if (movements.length === 0) return acc; // no movements yet — skip
    const derived = deriveProductStock(movements);
    if (Math.abs(derived - product.stock) > 0.001) {
      acc.push({ id: product.id, name: product.name, storedStock: product.stock, derivedStock: derived, diff: derived - product.stock });
    }
    return acc;
  }, []);
}
