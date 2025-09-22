


export type Currency = 'ARS' | 'USD';

export type Property = {
  id: string;
  name: string;
  imageUrl: string;
  description: string;
  notes: string;
  order?: number;
};

export type Wallet = {
  id: string;
  name: string;
  currency: Currency;
  balance: number;
  icon?: string;
  allowNegativeBalance?: boolean;
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
    name:string;
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
  propertyId: string;
  propertyName: string;
  subcategoryId: string;
  walletId: string;
  amount: number;
  currency: Currency;
  date: string; // ISO string
  notes?: string;
  liabilityId?: string; // If this expense is a payment for a liability
  assetId?: string; // If this expense is from creating an asset (loaning money)
};

export type Income = {
  id: string;
  propertyId: string;
  propertyName: string;
  subcategoryId: string;
  walletId: string;
  amount: number;
  currency: Currency;
  date: string; // ISO string
  notes: string;
  liabilityId?: string; // If this income came from a liability
  assetId?: string; // If this income is a collection from an asset
};

export type Transfer = {
  id: string;
  fromWalletId: string;
  toWalletId: string;
  amountSent: number;
  fromCurrency: Currency;
  amountReceived: number;
  toCurrency: Currency;
  exchangeRate?: number | null;
  date: string; // ISO string
  notes?: string;
};

export type Liability = {
  id: string;
  name: string;
  totalAmount: number;
  outstandingBalance: number;
  currency: Currency;
  creationDate: string | import('firebase/firestore').Timestamp; // ISO string or Timestamp
  notes?: string;
};

export type LiabilityPayment = {
  id: string;
  liabilityId: string;
  date: string; // ISO string
  amount: number;
  walletId: string;
  currency: Currency;
  notes?: string;
  actualExpenseId: string; // The corresponding expense entry
  propertyId: string; // The property where the expense was booked
};

export type Asset = {
  id: string;
  name: string;
  totalAmount: number; // Amount loaned
  outstandingBalance: number; // Amount yet to be collected
  currency: Currency;
  creationDate: string | import('firebase/firestore').Timestamp; // ISO string or Timestamp
  notes?: string;
};

export type AssetCollection = {
  id: string;
  assetId: string;
  date: string; // ISO string
  amount: number;
  walletId: string;
  currency: Currency;
  notes?: string;
  incomeId: string; // The corresponding income entry
  propertyId: string; // The property where the income was booked
};

export type Transaction = {
  id: string;
  date: Date;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  amount: number;
  currency: Currency;
  description: string;
  notes?: string;
  relatedEntity: string;
};

