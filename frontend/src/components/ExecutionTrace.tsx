import { CheckCircle2, Cpu, RadioTower } from "lucide-react";

const traceItems = [
  {
    tool: "QueryIntentParser",
    model: "Rule-based placeholder",
    confidence: "99%",
    status: "Ready"
  },
  {
    tool: "InputCompatibilityCheck",
    model: "GeoTIFF/TIFF validator",
    confidence: "96%",
    status: "Standby"
  },
  {
    tool: "ModelSelector",
    model: "BigEarthNet-adapted registry",
    confidence: "92%",
    status: "Queued"
  },
  {
    tool: "EvidenceComposer",
    model: "Spatial overlay renderer",
    confidence: "89%",
    status: "Queued"
  }
];

export function ExecutionTrace() {
  return (
    <section className="glass-panel flex min-h-0 flex-col p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="section-title">Execution Trace</p>
          <h2 className="mt-1 text-2xl font-bold text-space-text">Agent Plan</h2>
        </div>
        <div className="rounded-xl border border-trace-border/50 bg-trace-border/10 p-3 text-neon-cyan">
          <RadioTower size={22} />
        </div>
      </div>

      <div className="grid gap-3">
        {traceItems.map((item, index) => (
          <article key={item.tool} className="relative rounded-2xl border border-trace-border/35 bg-space-card/80 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-neon-cyan">Step {index + 1}</span>
                <h3 className="mt-1 text-sm font-bold text-space-text">{item.tool}</h3>
              </div>
              <CheckCircle2 className="text-trace-good" size={18} />
            </div>
            <div className="grid gap-2 text-xs text-space-soft">
              <span className="flex items-center gap-2">
                <Cpu size={14} />
                {item.model}
              </span>
              <div className="flex items-center justify-between">
                <span>{item.status}</span>
                <span className="font-semibold text-space-text">{item.confidence}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-space-muted">
                <div className="h-full rounded-full bg-neon-cyan" style={{ width: item.confidence }} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
