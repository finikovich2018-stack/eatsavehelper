"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/home", label: "Главная", icon: "🏠" },
  { href: "/fridge", label: "Холодильник", icon: "🧊" },
  { href: "/recipes", label: "Рецепты", icon: "🍳" },
  { href: "/budget", label: "Бюджет", icon: "💰" },
  { href: "/profile", label: "Профиль", icon: "👤" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-mobile -translate-x-1/2 border-t border-border bg-surface px-2 pb-safe">
      <ul className="flex items-center justify-around py-2">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-2 text-xs transition-opacity ${
                  isActive
                    ? "text-accent opacity-100"
                    : "text-muted opacity-40 grayscale"
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
