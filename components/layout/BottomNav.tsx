"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";

const tabs: { href: string; icon: string; labelKey: TranslationKey }[] = [
  { href: "/home", icon: "🏠", labelKey: "nav.home" },
  { href: "/fridge", icon: "❄️", labelKey: "nav.fridge" },
  { href: "/shopping", icon: "🛒", labelKey: "nav.shopping" },
  { href: "/recipes", icon: "👨‍🍳", labelKey: "nav.recipes" },
  { href: "/scan", icon: "📷", labelKey: "nav.scan" },
  { href: "/budget", icon: "💰", labelKey: "nav.budget" },
  { href: "/profile", icon: "👤", labelKey: "nav.profile" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  if (
    pathname.startsWith('/marketing') ||
    pathname.startsWith('/tutorial-manual') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/tg-status')
  ) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-mobile -translate-x-1/2 border-t border-border bg-surface px-1 pb-safe">
      <ul className="flex items-center justify-around py-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-1 text-[10px] transition-opacity ${
                  isActive ? "text-accent opacity-100" : "text-muted opacity-60"
                }`}
              >
                <span className={`text-lg ${isActive ? 'nav-active-icon' : ''}`}>{tab.icon}</span>
                <span>{t(tab.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
