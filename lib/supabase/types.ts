export type FridgeCategory =
  | "dairy"
  | "meat"
  | "veg"
  | "grains"
  | "other";

export type AddedFrom = "manual" | "receipt" | "ai";

export interface User {
  id: string;
  telegram_id: number;
  first_name: string | null;
  username: string | null;
  is_premium: boolean;
  created_at: string;
}

export interface FridgeItem {
  id: string;
  user_id: string;
  name: string;
  category: FridgeCategory;
  quantity: string | null;
  expiry_date: string | null;
  price: number | null;
  icon: string | null;
  added_from: AddedFrom;
  created_at: string;
}

export interface Receipt {
  id: string;
  user_id: string;
  total: number;
  store_name: string | null;
  scanned_at: string;
  raw_text: string | null;
}

export interface Budget {
  id: string;
  user_id: string;
  month: string;
  limit_amt: number;
}

export interface SavedRecipe {
  id: string;
  user_id: string;
  name: string;
  ingredients: unknown;
  steps: unknown;
  kcal: number | null;
  source: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      users: { Row: User; Insert: Partial<User>; Update: Partial<User> };
      fridge_items: {
        Row: FridgeItem;
        Insert: Partial<FridgeItem>;
        Update: Partial<FridgeItem>;
      };
      receipts: {
        Row: Receipt;
        Insert: Partial<Receipt>;
        Update: Partial<Receipt>;
      };
      budgets: {
        Row: Budget;
        Insert: Partial<Budget>;
        Update: Partial<Budget>;
      };
      saved_recipes: {
        Row: SavedRecipe;
        Insert: Partial<SavedRecipe>;
        Update: Partial<SavedRecipe>;
      };
    };
  };
}
