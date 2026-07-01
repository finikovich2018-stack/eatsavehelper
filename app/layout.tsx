import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "../components/layout/BottomNav";
import { AppProviders } from "../components/AppProviders";

export const metadata: Metadata = {
  title: "EatSave",
  description: "Smart fridge + smart wallet",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "EatSave",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <script async src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body className="bg-background text-foreground">
        <AppProviders>
          <main className="pb-16">{children}</main>
          <BottomNav />
        </AppProviders>
      </body>
    </html>
  );
}
