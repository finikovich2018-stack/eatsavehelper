import TopBar from "@/components/layout/TopBar";

export default function HomePage() {
  return (
    <main>
      <TopBar title="Главная" />
      <div className="px-4 py-6">
        <p className="text-muted">Добро пожаловать в EatSave</p>
      </div>
    </main>
  );
}
