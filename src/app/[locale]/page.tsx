import { Toaster } from "sonner";
import { GameShell } from "@/components/game/game-shell";
import { TopBar } from "@/components/game/top-bar";

export default function HomePage() {
  return (
    <div className="world-surface min-h-screen">
      <TopBar />
      <GameShell />
      <Toaster richColors position="top-center" />
    </div>
  );
}
