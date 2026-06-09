import { create } from "zustand";

interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
}

interface UserState {
  userId: string | null;
  isPremium: boolean;
  telegramUser: TelegramUser | null;
  setUser: (userId: string, telegramUser: TelegramUser) => void;
  setPremium: (isPremium: boolean) => void;
}

export const useUserStore = create<UserState>((set) => ({
  userId: null,
  isPremium: false,
  telegramUser: null,
  setUser: (userId, telegramUser) => set({ userId, telegramUser }),
  setPremium: (isPremium) => set({ isPremium }),
}));
