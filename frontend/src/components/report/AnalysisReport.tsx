import { ShieldCheck } from "lucide-react";
import { GroundingPreview } from "../GroundingPreview";
import { OrbivueLogo } from "../OrbivueLogo";
import { ReportCharts } from "./ReportCharts";
import { ReportSummary } from "./ReportSummary";
import "./analysisReport.css";
import {
  buildSummaryCards,
  chartDataForReport,
  chartTitleForMode,
  findingsForReport,
  formatGeneratedAt,
  reportTypeLabel,
  type ReportInput,
} from "./reportUtils";

type AnalysisReportProps = {
  report: ReportInput;
};

export function AnalysisReport({ report }: AnalysisReportProps) {
  const summaryCards = buildSummaryCards(report);
  const chartData = chartDataForReport(report);
  const findings = findingsForReport(report);
  const generatedAt = formatGeneratedAt(report.generatedAt);

  return (
    <article className="analysis-report" aria-label="OrbiVue AI Analysis Report">
      <header className="analysis-report-header">
        <div className="analysis-report-title">
          <OrbivueLogo className="analysis-report-logo" />
          <div>
            <p className="analysis-report-kicker">OrbiVue Intelligence</p>
            <h2>AI Analysis Report</h2>
          </div>
        </div>
        <div className="analysis-report-meta">
          <span>{reportTypeLabel(report.mode)}</span>
          <time>{generatedAt}</time>
        </div>
      </header>

      <section className="analysis-report-query">
        <span>User query</span>
        <p>{report.query?.trim() || "Initial visual analysis"}</p>
      </section>

      <ReportSummary cards={summaryCards} />

      <section className="analysis-report-section">
        <div className="analysis-report-section-heading">
          <h3>AI summary</h3>
          <span>Model output</span>
        </div>
        <p className="analysis-report-answer">{report.finalAnswer}</p>
      </section>

      <section className="analysis-report-section">
        <div className="analysis-report-section-heading">
          <h3>Key findings</h3>
          <span>Extracted text</span>
        </div>
        <div className="analysis-report-findings">
          {findings.length ? (
            findings.map((finding, index) => (
              <article key={`${finding.label}-${index}`}>
                <strong>{finding.label}</strong>
                <p>{finding.text}</p>
              </article>
            ))
          ) : (
            <p className="analysis-report-empty">No separately parseable findings were available.</p>
          )}
        </div>
      </section>

      <ReportImages report={report} />

      {report.mode === "grounding" && (
        <section className="analysis-report-section">
          <div className="analysis-report-section-heading">
            <h3>Detection summary</h3>
            <span>Bounding boxes</span>
          </div>
          <p className="analysis-report-answer">
            {(report.boundingBoxes?.length ?? 0) > 0
              ? `${report.boundingBoxes?.length ?? 0} verified region${
                  (report.boundingBoxes?.length ?? 0) === 1 ? "" : "s"
                } returned for this grounding request.`
              : "No verified regions were returned for this grounding request."}
          </p>
        </section>
      )}

      <ReportCharts title={chartTitleForMode(report.mode)} data={chartData} />

      <section className="analysis-report-note">
        <ShieldCheck size={18} />
        <p>
          Evidence note: visual analytics represent detected findings/categories from the AI result and should not
          be interpreted as precise area or percentage measurements unless explicitly provided by the analysis.
        </p>
      </section>
    </article>
  );
}

function ReportImages({ report }: { report: ReportInput }) {
  if (report.mode === "temporal") {
    return (
      <section className="analysis-report-section">
        <div className="analysis-report-section-heading">
          <h3>Before and after imagery</h3>
          <span>T1 / T2</span>
        </div>
        <div className="analysis-report-image-grid">
          {report.beforeImage && (
            <ReportFigure imageUrl={report.beforeImage.url} label={report.beforeImage.label} name={report.beforeImage.name} />
          )}
          {report.afterImage && (
            <ReportFigure imageUrl={report.afterImage.url} label={report.afterImage.label} name={report.afterImage.name} />
          )}
        </div>
      </section>
    );
  }

  if (!report.sourceImage?.url) {
    return null;
  }

  return (
    <section className="analysis-report-section">
      <div className="analysis-report-section-heading">
        <h3>Source image</h3>
        <span>{report.mode === "grounding" ? "Grounding source" : "Analysis source"}</span>
      </div>
      {report.mode === "grounding" ? (
        <GroundingPreview
          imageUrl={report.sourceImage.url}
          imageName={report.sourceImage.name}
          boundingBoxes={report.boundingBoxes ?? []}
        />
      ) : (
      <ReportFigure imageUrl={report.sourceImage.url} label={report.sourceImage.label || "Source"} name={report.sourceImage.name} />
      )}
    </section>
  );
}

function ReportFigure({ imageUrl, label, name }: { imageUrl: string; label?: string; name: string }) {
  return (
    <figure className="analysis-report-figure">
      <img src={imageUrl} alt={`${label || "Source"} image for report`} />
      <figcaption>
        <strong>{label || "Source"}</strong>
        <span>{name}</span>
      </figcaption>
    </figure>
  );
}
