import { AdminShell } from "@/components/game/admin-shell";
import { TopBar } from "@/components/game/top-bar";

export default function AdminPage() {
  return (
    <div className="world-surface flex min-h-dvh flex-col">
      <TopBar />
      <AdminShell />
    </div>
  );
}
