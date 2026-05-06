import { Category } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Food & Drinks', icon: 'Utensils', color: '#FFB7B2' }, // Pastel Red
  { id: '2', name: 'Transport', icon: 'Car', color: '#B2E2F2' }, // Pastel Blue
  { id: '3', name: 'Shopping', icon: 'ShoppingBag', color: '#FDFD96' }, // Pastel Yellow
  { id: '4', name: 'Entertainment', icon: 'Film', color: '#B2B2B2' }, // Muted Gray
  { id: '5', name: 'Health', icon: 'Heart', color: '#FF6961' }, // Muted Red
  { id: '6', name: 'Salary', icon: 'Wallet', color: '#77DD77' }, // Pastel Green
  { id: '7', name: 'Housing', icon: 'Home', color: '#CFCFC4' }, // Muted Earth
  { id: '8', name: 'Education', icon: 'GraduationCap', color: '#AEC6CF' }, // Muted Blue
];

export const CURRENCIES = [
  { code: 'GHS', symbol: 'GH₵' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'JPY', symbol: '¥' },
];
