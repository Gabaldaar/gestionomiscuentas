
export type Currency = 'ARS' | 'USD';

export type Property = {
  id: string;
  name: string;
  imageUrl: string;
  description: string;
  notes: string;
};

export type Wallet = {
  id: string;
  name: string;
  currency: Currency;
  balance: number;
};

export type ExpenseCategory = {
  id: string;
  name: string;
  subcategories: ExpenseSubcategory[];
};

export type ExpenseSubcategory = {
  id: string;
  name: string;
};

export type IncomeCategory = {
  id: string;
  name: string;
  subcategories: IncomeSubcategory[];
};

export type IncomeSubcategory = {
    id: string;
    name: string;
};

export type ExpectedExpense = {
  id: string;
  subcategoryId: string;
  amount: number;
  currency: Currency;
  month: number; // 1-12
  year: number;
};

export type ActualExpense = {
  id: string;
  subcategoryId: string;
  walletId: string;
  amount: number;
  currency: Currency;
  date: string; // ISO string
  notes?: string;
};

export type Income = {
  id: string;
  subcategoryId: string;
  walletId: string;
  amount: number;
  currency: Currency;
  date: string; // ISO string
  notes: string;
};

export type Transfer = {
  id: string;
  fromWalletId: string;
  toWalletId: string;
  fromAmount: number;
  toAmount: number;
  exchangeRate?: number;
  date: string; // ISO string
  notes: string;
};

