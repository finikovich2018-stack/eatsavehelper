import type { Metadata } from 'next';
import './globals.css';
import BottomNav from '../components/layout/BottomNav';

export const metadata: Metadata = {
  title: 'EatSave',
  description: 'Smart fridge + smart wallet',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="bg-zinc-950 text-white">
        <main className="pb-16">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
