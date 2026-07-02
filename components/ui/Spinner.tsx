export default function Spinner({
  className = "w-6 h-6 border-muted/30 border-t-accent",
}: {
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-label="loading"
      className={`inline-block rounded-full border-2 animate-spin ${className}`}
    />
  );
}
