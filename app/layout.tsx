import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "../components/layout/BottomNav";
import SwipeNavigator from "../components/layout/SwipeNavigator";
import { AppProviders } from "../components/AppProviders";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "EatSave",
  description: "Smart fridge + smart wallet",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/eatsave-logo.png",
    apple: "/eatsave-logo.png",
  },
  appleWebApp: {
    capable: true,
    title: "EatSave",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0f0a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={inter.className}>
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var c='#0c0f0a';document.documentElement.style.backgroundColor=c;function apply(){try{var tg=window.Telegram&&window.Telegram.WebApp;if(!tg)return;tg.ready();tg.setBackgroundColor(c);tg.setHeaderColor(c);}catch(e){}}apply();document.addEventListener('DOMContentLoaded',apply);})();`,
          }}
        />
      </head>
      <body className="bg-background text-foreground">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function d(){var s=document.getElementById('eatsave-splash');if(!s||s.classList.contains('eatsave-splash-out'))return;s.classList.add('eatsave-splash-out');setTimeout(function(){try{s.remove();}catch(e){}},360);}window.__EATSAVE_DISMISS_SPLASH__=d;setTimeout(d,1500);})();`,
          }}
        />
        <div id="eatsave-splash" className="eatsave-splash" aria-hidden="true" suppressHydrationWarning>
          <div className="eatsave-splash-glow" />
          <div className="eatsave-splash-content">
            <div className="eatsave-splash-logo-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/eatsave-logo.png" alt="" width={200} height={200} className="eatsave-splash-logo" />
            </div>
            <p className="eatsave-splash-brand">EatSave</p>
            <p className="eatsave-splash-welcome">Добро пожаловать</p>
            <p className="eatsave-splash-tagline">Умный холодильник и кошелёк</p>
            <div className="eatsave-splash-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
        <AppProviders>
          <SwipeNavigator>
            <main className="pb-16">{children}</main>
          </SwipeNavigator>
          <BottomNav />
        </AppProviders>
      </body>
    </html>
  );
}
