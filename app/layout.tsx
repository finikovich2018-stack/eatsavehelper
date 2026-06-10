import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "../components/layout/BottomNav";
import { TelegramProvider } from "../components/TelegramProvider";

export const metadata: Metadata = {
  title: "EatSave",
  description: "Smart fridge + smart wallet",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <script async src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body className="bg-zinc-950 text-white">
        <TelegramProvider>
          <main className="pb-16">{children}</main>
          <BottomNav />
        </TelegramProvider>
      </body>
    </html>
  );
}
