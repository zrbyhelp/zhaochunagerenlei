import { Toaster } from "sonner";
import { GameShell } from "@/components/game/game-shell";
import { TopBar } from "@/components/game/top-bar";

export default function HomePage() {
  return (
    <div className="world-surface flex min-h-dvh flex-col">
      <TopBar />
      <GameShell />
      <Toaster richColors position="top-center" />
    </div>
  );
}
