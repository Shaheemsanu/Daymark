import { Expense } from '../types';

/** Loan principal and repayments are account movements, not operating income or spending. */
export const LOAN_MOVEMENT_CATEGORY = 'Loan funds movement';
export const LOAN_MOVEMENT_CATEGORIES = [LOAN_MOVEMENT_CATEGORY, 'Loan: Money lent', 'Loan: Money borrowed', 'Loan: EMI / loan'] as const;
export const isLoanMovement = (expense: Expense) => (LOAN_MOVEMENT_CATEGORIES as readonly string[]).includes(expense.category);
