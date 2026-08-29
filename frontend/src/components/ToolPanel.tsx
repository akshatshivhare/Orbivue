import { Flame, LocateFixed, MapPinned, Radar, Trees, Waves } from "lucide-react";
import type { Tool } from "./types";

interface ToolPanelProps {
  tools: Tool[];
  activeTools: string[];
  onToggleTool: (toolId: string) => void;
}

const iconMap = {
  change: Trees,
  fusion: Radar,
  heat: Flame,
  aqi: Waves,
  contours: MapPinned,
  grounding: LocateFixed
};

export function ToolPanel({ tools, activeTools, onToggleTool }: ToolPanelProps) {
  return (
    <section className="glass-panel p-5">
      <div className="mb-4">
        <p className="section-title">Specialist Toolkit</p>
        <h2 className="mt-1 text-xl font-bold text-space-text">Toggle analysis layers</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tools.map((tool) => {
          const Icon = iconMap[tool.id as keyof typeof iconMap] ?? LocateFixed;
          const isActive = activeTools.includes(tool.id);
          return (
            <button
              key={tool.id}
              onClick={() => onToggleTool(tool.id)}
              className={`rounded-2xl border p-4 text-left transition ${
                isActive
                  ? "border-neon-blue bg-neon-blue/15 text-white shadow-glow"
                  : "border-space-border bg-space-card text-space-soft hover:border-neon-cyan/60"
              }`}
              aria-pressed={isActive}
            >
              <Icon className={isActive ? "text-neon-cyan" : "text-space-soft"} size={22} />
              <span className="mt-3 block text-sm font-bold">{tool.label}</span>
              <span className="mt-1 block text-xs leading-5 text-space-soft">{tool.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
