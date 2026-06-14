"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/home", icon: "🏠", label: "Главная" },
  { href: "/fridge", icon: "❄️", label: "Холодильник" },
  { href: "/scan", icon: "📷", label: "Сканер" },
  { href: "/budget", icon: "💰", label: "Бюджет" },
  { href: "/profile", icon: "👤", label: "Профиль" },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-mobile -translate-x-1/2 border-t border-zinc-800 bg-zinc-900 px-2 pb-safe">
      <ul className="flex items-center justify-around py-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link href={tab.href} className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-2 text-xs transition-opacity ${isActive ? "text-green-400 opacity-100" : "text-zinc-400 opacity-60"}`}>
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