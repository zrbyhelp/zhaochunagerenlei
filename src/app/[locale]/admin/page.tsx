import { AdminShell } from "@/components/game/admin-shell";
import { TopBar } from "@/components/game/top-bar";

export default function AdminPage() {
  return (
    <div className="world-surface min-h-screen">
      <TopBar />
      <AdminShell />
    </div>
  );
}
