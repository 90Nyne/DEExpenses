export type TransactionType = 'income' | 'expense';

export interface Category {
  id: string;
  userId?: string;
  name: string;
  icon: string;
  color: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  date: string;
  note: string;
  createdAt: any;
  updatedAt: any;
}

export interface UserSettings {
  userId: string;
  currency: string;
  theme: 'light' | 'dark';
  updatedAt: any;
}
