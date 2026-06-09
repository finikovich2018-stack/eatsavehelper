import { create } from "zustand";
import type { FridgeItem } from "@/lib/supabase/types";

type Filter = "all" | "expiring" | "dairy" | "meat" | "veg" | "grains";

interface FridgeState {
  items: FridgeItem[];
  activeFilter: Filter;
  setFilter: (filter: Filter) => void;
  addItem: (item: FridgeItem) => void;
  removeItem: (id: string) => void;
}

export const useFridgeStore = create<FridgeState>((set) => ({
  items: [],
  activeFilter: "all",
  setFilter: (filter) => set({ activeFilter: filter }),
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  removeItem: (id) =>
    set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));
