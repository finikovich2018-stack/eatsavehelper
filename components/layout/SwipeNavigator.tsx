"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const TAB_ORDER = [
  "/home",
  "/fridge",
  "/shopping",
  "/recipes",
  "/scan",
  "/budget",
  "/profile",
];

const MIN_DISTANCE = 55; // px horizontal to count as a swipe
const MAX_OFF_AXIS = 0.6; // vertical/horizontal ratio limit (mostly-horizontal)
const MAX_DURATION = 600; // ms, ignore slow drags

/** Returns true if the touch started inside a horizontally scrollable element. */
function isInHorizontalScroller(target: EventTarget | null): boolean {
  let node = target as HTMLElement | null;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const ox = style.overflowX;
    if ((ox === "auto" || ox === "scroll") && node.scrollWidth > node.clientWidth + 2) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

function tabIndex(pathname: string): number {
  return TAB_ORDER.findIndex(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  );
}

export default function SwipeNavigator({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const start = useRef<{ x: number; y: number; t: number; skip: boolean } | null>(null);
  const prevIndex = useRef(tabIndex(pathname));
  const [animClass, setAnimClass] = useState("");

  useEffect(() => {
    const idx = tabIndex(pathname);
    if (idx !== -1 && prevIndex.current !== -1 && idx !== prevIndex.current) {
      setAnimClass(idx > prevIndex.current ? "tab-anim-right" : "tab-anim-left");
    } else {
      setAnimClass("");
    }
    prevIndex.current = idx;
  }, [pathname]);

  useEffect(() => {
    const currentIndex = tabIndex(pathname);
    const enabled =
      currentIndex !== -1 &&
      !pathname.startsWith("/marketing") &&
      !pathname.startsWith("/tutorial-manual");

    if (!enabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        start.current = null;
        return;
      }
      const touch = e.touches[0];
      start.current = {
        x: touch.clientX,
        y: touch.clientY,
        t: Date.now(),
        skip: isInHorizontalScroller(e.target),
      };
    };

    const onTouchEnd = (e: TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s || s.skip) return;
      if (Date.now() - s.t > MAX_DURATION) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - s.x;
      const dy = touch.clientY - s.y;

      if (Math.abs(dx) < MIN_DISTANCE) return;
      if (Math.abs(dy) > Math.abs(dx) * MAX_OFF_AXIS) return;

      // Swipe left -> next tab, swipe right -> previous tab
      const nextIndex = dx < 0 ? currentIndex + 1 : currentIndex - 1;
      if (nextIndex < 0 || nextIndex >= TAB_ORDER.length) return;

      router.push(TAB_ORDER[nextIndex]);
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pathname, router]);

  return (
    <div key={pathname} className={animClass}>
      {children}
    </div>
  );
}
