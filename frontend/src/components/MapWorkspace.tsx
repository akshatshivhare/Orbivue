import { Box, Layers, Map, Mountain, ScanLine } from "lucide-react";
import type { MapMode } from "./types";

interface MapWorkspaceProps {
  mapMode: MapMode;
  onChangeMapMode: (mode: MapMode) => void;
  activeTools: string[];
}

export function MapWorkspace({ mapMode, onChangeMapMode, activeTools }: MapWorkspaceProps) {
  return (
    <section className="glass-panel flex min-h-[520px] flex-col overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-space-border p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="section-title">Map Workspace</p>
          <h2 className="mt-1 text-2xl font-bold text-space-text">Indore multisensor scene</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-space-border bg-space-bg/70 p-1">
          <button
            onClick={() => onChangeMapMode("2d")}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
              mapMode === "2d" ? "bg-neon-cyan text-space-bg shadow-glow" : "text-space-soft hover:bg-space-card"
            }`}
          >
            <Map size={17} />
            2D Map
          </button>
          <button
            onClick={() => onChangeMapMode("3d")}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
              mapMode === "3d" ? "bg-neon-blue text-white shadow-glow" : "text-space-soft hover:bg-space-card"
            }`}
          >
            <Mountain size={17} />
            3D Terrain
          </button>
        </div>
      </div>

      <div className="relative min-h-[420px] flex-1 overflow-hidden bg-satellite-grid">
        {mapMode === "2d" ? <Map2D activeTools={activeTools} /> : <Terrain3D activeTools={activeTools} />}
      </div>
    </section>
  );
}

function Map2D({ activeTools }: { activeTools: string[] }) {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 opacity-75 [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:46px_46px]" />
      <div className="absolute left-[12%] top-[16%] h-44 w-64 rotate-[-12deg] rounded-[45%] bg-emerald-500/25 blur-sm" />
      <div className="absolute right-[10%] top-[20%] h-52 w-72 rounded-[45%] bg-cyan-400/30 blur-sm" />
      <div className="absolute bottom-[12%] left-[30%] h-32 w-72 rotate-[18deg] rounded-full bg-amber-400/20 blur-sm" />
      <div className="absolute left-[22%] top-[52%] h-24 w-44 border-2 border-neon-cyan bg-neon-cyan/10" />
      <div className="absolute right-[22%] top-[34%] h-20 w-36 border-2 border-neon-green bg-neon-green/10" />
      <div className="absolute bottom-[22%] right-[18%] h-24 w-24 rounded-full border-2 border-neon-amber bg-neon-amber/10" />
      <OverlayBadges activeTools={activeTools} />
      <div className="absolute bottom-5 left-5 flex items-center gap-2 rounded-xl border border-space-border bg-space-bg/80 px-4 py-2 text-sm text-space-soft">
        <ScanLine size={16} />
        2D optical/SAR placeholder layer
      </div>
    </div>
  );
}

function Terrain3D({ activeTools }: { activeTools: string[] }) {
  return (
    <div className="absolute inset-0 perspective-[900px]">
      <div className="absolute inset-x-10 top-20 h-72 rotate-x-[62deg] rounded-[2rem] border border-neon-blue/50 bg-space-card shadow-glow [background-image:linear-gradient(rgba(34,211,238,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.16)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="absolute left-[20%] top-[30%] h-24 w-40 rotate-[-16deg] rounded-full bg-neon-cyan/25 blur-xl" />
      <div className="absolute right-[26%] top-[40%] h-20 w-44 rotate-[14deg] rounded-full bg-neon-blue/30 blur-xl" />
      <OverlayBadges activeTools={activeTools} />
      <div className="absolute bottom-5 left-5 flex items-center gap-2 rounded-xl border border-neon-blue/40 bg-space-bg/80 px-4 py-2 text-sm text-space-soft">
        <Box size={16} />
        3D preview placeholder
      </div>
    </div>
  );
}

function OverlayBadges({ activeTools }: { activeTools: string[] }) {
  return (
    <div className="absolute right-5 top-5 grid max-w-xs gap-2">
      {activeTools.length === 0 ? (
        <span className="rounded-xl border border-space-border bg-space-bg/80 px-3 py-2 text-xs font-semibold text-space-soft">
          No custom tools active
        </span>
      ) : activeTools.map((tool) => (
        <span key={tool} className="flex items-center gap-2 rounded-xl border border-neon-cyan/50 bg-neon-cyan/10 px-3 py-2 text-xs font-bold text-neon-cyan">
          <Layers size={14} />
          {tool}
        </span>
      ))}
    </div>
  );
}
