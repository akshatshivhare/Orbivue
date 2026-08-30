import { Printer, Sparkles, X } from "lucide-react";
import { OrbivueLogo } from "../OrbivueLogo";
import { AnalysisReport } from "./AnalysisReport";
import type { ReportInput } from "./reportUtils";

type ReportPreviewModalProps = {
  report: ReportInput | null;
  isEmpty?: boolean;
  onClose: () => void;
  onStartAnalysis: () => void;
};

export function ReportPreviewModal({
  report,
  isEmpty = false,
  onClose,
  onStartAnalysis,
}: ReportPreviewModalProps) {
  return (
    <div className="report-modal fixed inset-0 z-50 flex items-center justify-center bg-[#061b22]/58 p-4 backdrop-blur-sm">
      <section
        className="report-modal-panel flex max-h-[92svh] w-full max-w-[1080px] flex-col overflow-hidden rounded-[1.35rem] border border-[#c9ddd4] bg-[#fbfaf6] text-[#173452] shadow-[0_28px_80px_rgba(6,27,34,0.35)]"
        role="dialog"
        aria-modal="true"
        aria-label={isEmpty ? "Report empty state" : "OrbiVue report preview"}
      >
        <header className="report-modal-actions flex items-center justify-between gap-4 border-b border-[#d8e1dc] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <OrbivueLogo className="w-[150px] shrink-0" />
            <div className="hidden min-w-0 sm:block">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0b6048]">Report Preview</p>
              <h2 className="truncate text-lg font-black text-[#10233a]">AI Analysis Report</h2>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isEmpty && report && (
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-lg bg-[#00624b] px-3.5 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[#004d3b]"
              >
                <Printer size={16} />
                Print / Save PDF
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d8e1dc] bg-white text-[#10233a] shadow-sm transition hover:bg-[#e8f4eb]"
              aria-label="Close report preview"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="report-modal-scroll min-h-0 overflow-y-auto p-5">
          {isEmpty || !report ? (
            <div className="mx-auto grid max-w-[560px] justify-items-center gap-4 rounded-2xl border border-[#d8e1dc] bg-white/84 px-6 py-10 text-center shadow-sm">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f4eb] text-[#0b6048]">
                <Sparkles size={26} />
              </span>
              <div>
                <h3 className="text-xl font-black text-[#10233a]">Run an analysis first to generate an OrbiVue report.</h3>
                <p className="mt-2 text-sm leading-6 text-[#657a8c]">
                  Complete a single-image, visual grounding, or temporal change analysis, then open the report preview from the result.
                </p>
              </div>
              <button
                type="button"
                onClick={onStartAnalysis}
                className="rounded-lg bg-[#00624b] px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[#004d3b]"
              >
                Ask OrbiVue
              </button>
            </div>
          ) : (
            <AnalysisReport report={report} />
          )}
        </div>
      </section>
    </div>
  );
}
