import { useEffect, useState } from "react";
import { ChevronsLeftRight, RotateCcw } from "lucide-react";

type BeforeAfterSliderProps = {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
};

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "BEFORE / T1",
  afterLabel = "AFTER / T2",
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50);

  useEffect(() => {
    setPosition(50);
  }, [beforeUrl, afterUrl]);

  return (
    <section className="rounded-2xl border border-[#c9ddd4] bg-[#fbfaf6]/95 p-3 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-[#10233a]">Visual comparison</h3>
          <p className="mt-0.5 text-xs font-semibold text-[#657a8c]">Drag the divider to reveal T2 over T1.</p>
        </div>
        <button
          type="button"
          onClick={() => setPosition(50)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8e1dc] bg-white px-3 py-1.5 text-xs font-black text-[#0b6048] shadow-sm transition hover:bg-[#e8f4eb]"
          aria-label="Reset before and after comparison slider to 50 percent"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>

      <div className="before-after-slider relative isolate mx-auto max-h-[420px] min-h-[220px] overflow-hidden rounded-xl border border-[#d8e1dc] bg-[#0d2730] shadow-inner">
        <img
          src={beforeUrl}
          alt={`${beforeLabel} comparison image`}
          className="block h-full max-h-[420px] min-h-[220px] w-full object-contain"
          draggable={false}
        />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          aria-hidden="true"
        >
          <img
            src={afterUrl}
            alt=""
            className="h-full w-full object-contain"
            draggable={false}
          />
        </div>

        <span className="absolute left-3 top-3 rounded-full bg-[#10233a]/78 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-white shadow-sm">
          {beforeLabel}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-[#00624b]/84 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-white shadow-sm">
          {afterLabel}
        </span>

        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.15),0_0_18px_rgba(255,255,255,0.7)]"
          style={{ left: `${position}%` }}
        >
          <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-[#00624b] text-white shadow-[0_10px_28px_rgba(0,55,42,0.28)]">
            <ChevronsLeftRight size={20} strokeWidth={2.1} />
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="100"
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          className="before-after-range absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
          aria-label="Reveal after image over before image"
        />
      </div>
    </section>
  );
}
