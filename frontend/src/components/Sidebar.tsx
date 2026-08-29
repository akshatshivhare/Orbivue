import { Activity, Crosshair, Database, Globe2, Layers3, Satellite } from "lucide-react";
import type { Tool } from "./types";

interface SidebarProps {
  tools: Tool[];
  activeTools: string[];
  onToggleTool: (toolId: string) => void;
}

const navItems = [
  { label: "Mission Control", icon: Globe2, active: true },
  { label: "Dataset Vault", icon: Database, active: false },
  { label: "Model Registry", icon: Layers3, active: false },
  { label: "Ground Truth", icon: Crosshair, active: false }
];

export function Sidebar({ tools, activeTools, onToggleTool }: SidebarProps) {
  return (
    <aside className="glass-panel flex min-h-0 flex-col gap-6 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan shadow-glow">
          <Satellite size={25} />
        </div>
        <div>
          <p className="section-title">Orbivue</p>
          <h1 className="text-xl font-bold text-space-text">SatQuery AI</h1>
        </div>
      </div>

      <nav className="grid gap-2" aria-label="Dashboard navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                item.active
                  ? "border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan"
                  : "border-transparent text-space-soft hover:border-space-border hover:bg-space-card"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <section className="rounded-2xl border border-trace-border/40 bg-space-card p-4">
        <div className="mb-3 flex items-center gap-2 text-neon-green">
          <Activity size={17} />
          <span className="text-sm font-semibold">Agent online</span>
        </div>
        <p className="text-sm leading-6 text-space-soft">
          Static dashboard mode. Tools can be selected locally before backend orchestration is connected.
        </p>
      </section>

      <section className="min-h-0 flex-1">
        <p className="section-title mb-3">Custom Tools</p>
        <div className="grid gap-2">
          {tools.map((tool) => {
            const isActive = activeTools.includes(tool.id);
            return (
              <button
                key={tool.id}
                onClick={() => onToggleTool(tool.id)}
                className={`rounded-xl border p-3 text-left transition ${
                  isActive
                    ? "border-neon-cyan bg-neon-cyan/15 text-white shadow-glow"
                    : "border-space-border bg-space-card/70 text-space-soft hover:border-neon-blue/70"
                }`}
                aria-pressed={isActive}
              >
                <span className="block text-sm font-bold">{tool.label}</span>
                <span className="mt-1 block text-xs leading-5 text-space-soft">{tool.description}</span>
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
