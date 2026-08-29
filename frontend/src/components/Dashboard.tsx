import { useState } from "react";
import { ChatBar } from "./ChatBar";
import { ExecutionTrace } from "./ExecutionTrace";
import { MapWorkspace } from "./MapWorkspace";
import { Sidebar } from "./Sidebar";
import { ToolPanel } from "./ToolPanel";
import type { ChatMessage, MapMode, Tool } from "./types";

const tools: Tool[] = [
  { id: "change", label: "Change Detection", description: "Compare dates and flag new construction, vegetation loss, or floods." },
  { id: "fusion", label: "Optical-SAR Fusion", description: "Blend visible texture and radar-like structural evidence." },
  { id: "heat", label: "Heat Map", description: "Preview thermal-style surface intensity overlays." },
  { id: "aqi", label: "AQI Layer", description: "Show pollution-risk styling for urban corridors." },
  { id: "contours", label: "Contours", description: "Draw topographic contour hints over terrain." },
  { id: "grounding", label: "Visual Grounding", description: "Highlight query-specific regions in the scene." }
];

const initialMessages: ChatMessage[] = [
  {
    id: 1,
    role: "assistant",
    text: "SatQuery dashboard is in static mode. Pick tools, switch map modes, and type a sample query."
  },
  {
    id: 2,
    role: "user",
    text: "Use optical and SAR images together to identify built-up and water-covered regions."
  }
];

export function Dashboard() {
  const [mapMode, setMapMode] = useState<MapMode>("2d");
  const [activeTools, setActiveTools] = useState<string[]>(["fusion", "grounding"]);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  function toggleTool(toolId: string) {
    setActiveTools((current) =>
      current.includes(toolId)
        ? current.filter((item) => item !== toolId)
        : [...current, toolId]
    );
  }

  function appendMessage(text: string) {
    setMessages((current) => [
      ...current,
      {
        id: Date.now(),
        role: "user",
        text
      }
    ]);
  }

  return (
    <main className="min-h-screen bg-space-bg p-4 text-space-text lg:p-6">
      <div className="mx-auto grid max-w-[1800px] gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Sidebar tools={tools} activeTools={activeTools} onToggleTool={toggleTool} />

        <section className="grid min-h-[calc(100vh-3rem)] gap-4 xl:grid-rows-[auto_1fr_auto]">
          <header className="glass-panel flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="section-title">Mission Dashboard</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-space-text md:text-4xl">
                Multimodal remote sensing command center
              </h1>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Metric label="Inputs" value="3" />
              <Metric label="Active tools" value={String(activeTools.length)} />
              <Metric label="Mode" value={mapMode.toUpperCase()} />
            </div>
          </header>

          <div className="grid min-h-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid min-h-0 gap-4">
              <MapWorkspace mapMode={mapMode} onChangeMapMode={setMapMode} activeTools={activeTools} />
              <ToolPanel tools={tools} activeTools={activeTools} onToggleTool={toggleTool} />
            </div>
            <ExecutionTrace />
          </div>

          <ChatBar messages={messages} onSubmitMessage={appendMessage} />
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-space-border bg-space-card px-4 py-3">
      <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-space-soft">{label}</span>
      <strong className="mt-1 block text-lg text-neon-cyan">{value}</strong>
    </div>
  );
}
