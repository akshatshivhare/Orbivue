import { ShieldCheck } from "lucide-react";

export function StatusBar() {
  return (
    <footer className="main-footer relative z-20 grid min-h-[3.4rem] grid-cols-1 items-center gap-2 bg-[#005742] px-5 py-3 text-sm text-white/85 md:grid-cols-3 md:px-8 md:py-0">
      <div className="flex items-center gap-3">
        <span>Data Sources</span>
        <span className="h-2.5 w-2.5 rounded-full bg-[#37c861]" />
        <span>Live</span>
      </div>
      <div className="md:text-center">Last updated: May 15, 2026, 10:31 AM IST</div>
      <div className="flex flex-wrap items-center gap-x-7 gap-y-2 md:justify-end">
        <span>Privacy</span>
        <span>Terms</span>
        <span>Feedback</span>
        <span className="flex items-center gap-3">
          <ShieldCheck size={22} />
          All systems normal
        </span>
      </div>
    </footer>
  );
}
