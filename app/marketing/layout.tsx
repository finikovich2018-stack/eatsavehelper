import MarketingBottomNav from '@/components/marketing/MarketingBottomNav';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <MarketingBottomNav />
    </>
  );
}
