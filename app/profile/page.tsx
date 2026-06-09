import TopBar from "@/components/layout/TopBar";

export default function ProfilePage() {
  return (
    <main>
      <TopBar title="Профиль" />
      <div className="px-4 py-6">
        <p className="text-muted">Ваш профиль</p>
      </div>
    </main>
  );
}
