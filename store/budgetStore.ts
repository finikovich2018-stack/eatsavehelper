import { create } from "zustand";

interface BudgetState {
  monthlyLimit: number;
  spent: number;
  setLimit: (limit: number) => void;
  addExpense: (amount: number) => void;
}

export const useBudgetStore = create<BudgetState>((set) => ({
  monthlyLimit: 15000,
  spent: 0,
  setLimit: (limit) => set({ monthlyLimit: limit }),
  addExpense: (amount) => set((s) => ({ spent: s.spent + amount })),
}));
