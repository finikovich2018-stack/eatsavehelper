type TopBarProps = {
  title: string;
};

export default function TopBar({ title }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-4 backdrop-blur">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
    </header>
  );
}
