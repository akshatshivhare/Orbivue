import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { GroundingPreview } from "../GroundingPreview";
import { OrbivueLogo } from "../OrbivueLogo";
import type { ChangeGuardPayload } from "../workspaceTypes";
import type { LanguageCode, TranslationKey } from "../../i18n/translations";
import { ReportCharts } from "./ReportCharts";
import "./analysisReport.css";
import {
  chartDataForReport,
  chartTitleForMode,
  findingsForReport,
  formatGeneratedAt,
  formatGuardNumber,
  formatGuardPixelFraction,
  reportTypeLabel,
  temporalGuardStatusLabel,
  temporalSemanticVerificationLabel,
  type ReportInput,
} from "./reportUtils";

type AnalysisReportProps = {
  report: ReportInput;
  language: LanguageCode;
  t: (key: TranslationKey) => string;
};

export function AnalysisReport({ report, language, t }: AnalysisReportProps) {
  const generatedAt = formatGeneratedAt(report.generatedAt);
  const findings = findingsForReport(report);
  const chartData = chartDataForReport(report);
  const limitations = limitationsForReport(report);

  return (
    <article className="analysis-report" aria-label="ORBIVUE analysis report">
      <header className="analysis-report-header">
        <div className="analysis-report-title">
          <OrbivueLogo className="analysis-report-logo" />
          <div>
            <p className="analysis-report-kicker">ORBIVUE Earth Intelligence</p>
            <h2>{t("report.analysisReport")}</h2>
          </div>
        </div>
        <dl className="analysis-report-meta">
          <div>
            <dt>{t("report.mode")}</dt>
            <dd>{reportTypeLabel(report.mode)}</dd>
          </div>
          <div>
            <dt>Generated</dt>
            <dd>{generatedAt}</dd>
          </div>
          <div>
            <dt>{t("report.mode")}</dt>
            <dd>{modeLabel(report)}</dd>
          </div>
        </dl>
      </header>

      <section className="analysis-report-query">
        <span>User query</span>
        <p>{report.query?.trim() || "Initial visual analysis"}</p>
      </section>

      <ReportSection title={t("report.summary")} label={t("report.resultOverview")}>
        <p className="analysis-report-answer">{executiveSummary(report)}</p>
      </ReportSection>

      <ReportImages report={report} t={t} />

      <ReportSection title={t("report.keyFindings")} label={t("report.readableFindings")}>
        <div className="analysis-report-findings">
          {findings.length ? (
            findings.map((finding, index) => (
              <article key={`${finding.label}-${index}`}>
                <strong>{finding.label}</strong>
                <p>{finding.text}</p>
              </article>
            ))
          ) : (
            <p className="analysis-report-empty">{t("report.noFindings")}</p>
          )}
        </div>
      </ReportSection>

      <EvidenceSection report={report} t={t} />

      {report.mode === "temporal" && report.changeAnalysis && <DetailedChangeSection report={report} t={t} />}

      <TrustEvidenceSection report={report} t={t} />

      {chartData.length > 0 && <ReportCharts title={chartTitleForMode(report.mode)} data={chartData} />}

      <ReportSection title={t("report.limitations")} label={t("report.useWithCare")}>
        <ul className="analysis-report-list">
          {limitations.map((limitation, index) => (
            <li key={`${limitation}-${index}`}>{limitation}</li>
          ))}
        </ul>
      </ReportSection>

      <section className="analysis-report-note">
        <ShieldCheck size={18} />
        <p>
          ORBIVUE reports summarize current session outputs. AI-generated semantic interpretations are not
          independent scientific verification unless deterministic evidence is explicitly listed.
        </p>
      </section>
    </article>
  );
}

function ReportSection({
  title,
  label,
  children,
}: {
  title: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="analysis-report-section">
      <div className="analysis-report-section-heading">
        <h3>{title}</h3>
        <span>{label}</span>
      </div>
      {children}
    </section>
  );
}

function ReportImages({ report, t }: { report: ReportInput; t: (key: TranslationKey) => string }) {
  if (report.mode === "cross_modal") {
    return (
      <ReportSection title={t("report.inputImagery")} label="Optical + SAR">
        <div className="analysis-report-image-grid">
          {report.opticalImage && (
            <ReportFigure imageUrl={report.opticalImage.url} label={report.opticalImage.label} name={report.opticalImage.name} />
          )}
          {report.sarImage && (
            <ReportFigure imageUrl={report.sarImage.url} label={report.sarImage.label} name={report.sarImage.name} />
          )}
        </div>
      </ReportSection>
    );
  }

  if (report.mode === "temporal") {
    return (
      <ReportSection title={t("report.inputImagery")} label="T1 / T2">
        <div className="analysis-report-image-grid">
          {report.beforeImage && (
            <ReportFigure imageUrl={report.beforeImage.url} label={report.beforeImage.label} name={report.beforeImage.name} />
          )}
          {report.afterImage && (
            <ReportFigure imageUrl={report.afterImage.url} label={report.afterImage.label} name={report.afterImage.name} />
          )}
        </div>
      </ReportSection>
    );
  }

  if (!report.sourceImage?.url) {
    return null;
  }

  return (
    <ReportSection title={t("report.inputImagery")} label={report.mode === "grounding" ? "Grounding source" : "Analysis source"}>
      {report.mode === "grounding" ? (
        <GroundingPreview
          imageUrl={report.sourceImage.url}
          imageName={report.sourceImage.name}
          boundingBoxes={report.boundingBoxes ?? []}
        />
      ) : (
        <ReportFigure imageUrl={report.sourceImage.url} label={report.sourceImage.label || "Source"} name={report.sourceImage.name} />
      )}
    </ReportSection>
  );
}

function EvidenceSection({ report, t }: { report: ReportInput; t: (key: TranslationKey) => string }) {
  if (report.mode === "grounding") {
    const boxes = report.boundingBoxes ?? [];
    return (
      <ReportSection title={t("report.evidence")} label="Grounding evidence">
        <div className="analysis-report-findings">
          <article>
            <strong>{boxes.length} localized {boxes.length === 1 ? "region" : "regions"}</strong>
            <p>{boxes.length ? boxes.map((box) => box.label || "region").join(", ") : "No localized regions returned."}</p>
          </article>
        </div>
      </ReportSection>
    );
  }

  if (report.mode === "temporal") {
    return <TemporalGuardReportSection report={report} t={t} />;
  }

  return (
    <ReportSection title={t("report.evidence")} label="Interpretation status">
      <p className="analysis-report-answer">AI-generated interpretation — not independently verified.</p>
    </ReportSection>
  );
}

function DetailedChangeSection({ report, t }: { report: ReportInput; t: (key: TranslationKey) => string }) {
  const analysis = report.changeAnalysis;
  if (!analysis) {
    return null;
  }

  return (
    <ReportSection title={t("report.detailedChange")} label="Temporal details">
      <div className="analysis-report-change-overview">
        <strong>Overall Change</strong>
        <p>{analysis.summary || analysis.final_answer}</p>
      </div>

      {analysis.changes.length > 0 && (
        <div className="analysis-report-change-table" role="table" aria-label="Detected temporal changes">
          <div role="row" className="analysis-report-change-row is-header">
            <span>Change Type</span>
            <span>What Changed</span>
            <span>{t("report.locationRegion")}</span>
            <span>Direction</span>
            <span>Notes</span>
          </div>
          {analysis.changes.map((change, index) => (
            <div role="row" className="analysis-report-change-row" key={`${change.category}-${index}`}>
              <span>{change.category}</span>
              <span>{change.change || change.description}</span>
              <span>{change.location || "Not specified"}</span>
              <span>{change.direction}</span>
              <span>{observabilityLabel(change.observability) || change.description}</span>
            </div>
          ))}
        </div>
      )}

      {analysis.unchanged.length > 0 && <ReportList title={t("report.unchanged")} items={analysis.unchanged} />}
      {(analysis.possible_imaging_effects?.length ?? 0) > 0 && (
        <ReportList title={t("report.imagingEffects")} items={analysis.possible_imaging_effects ?? []} />
      )}
    </ReportSection>
  );
}

function TemporalGuardReportSection({ report, t }: { report: ReportInput; t: (key: TranslationKey) => string }) {
  const guard = report.changeAnalysis?.change_guard;

  if (!guard) {
    return (
      <ReportSection title={t("report.evidence")} label="Temporal status">
        <p className="analysis-report-answer">Model interpretation returned without ChangeGuard metadata.</p>
      </ReportSection>
    );
  }

  return (
    <ReportSection title={t("report.evidence")} label="ChangeGuard">
      <div className="analysis-report-evidence-grid">
        <EvidenceMetric label="Status" value={temporalGuardStatusLabel(guard)} />
        <EvidenceMetric label="Exact match" value={guard.exact_match === undefined ? "Not provided" : guard.exact_match ? "Yes" : "No"} />
        <EvidenceMetric label="Qwen called" value={guard.qwen_called === undefined ? "Not provided" : guard.qwen_called ? "Yes" : "No"} />
        <EvidenceMetric label="Semantic state" value={temporalSemanticVerificationLabel(guard)} />
        <EvidenceMetric label="Mean image difference" value={formatGuardNumber(guard.mean_absolute_difference)} />
        <EvidenceMetric label="Changed pixel fraction" value={formatGuardPixelFraction(guard.changed_pixel_fraction)} />
      </div>
      {guard.dimension_normalized && (
        <p className="analysis-report-caution">
          Images were normalized to a common resolution for image-space comparison. This does not establish geospatial registration.
        </p>
      )}
      <p className="analysis-report-caution">
        Changed pixel fraction is an image-space comparison metric and does not represent physical changed land area.
      </p>
    </ReportSection>
  );
}

function TrustEvidenceSection({ report, t }: { report: ReportInput; t: (key: TranslationKey) => string }) {
  const guard = report.changeAnalysis?.change_guard;
  const rows = [
    [t("trust.inputValidation"), "INPUT READY"],
    [t("trust.analysisMode"), modeLabel(report).toUpperCase()],
    ["ChangeGuard", guard ? changeGuardReportStatus(guard) : "NOT EVALUATED"],
    [t("trust.crossSensor"), report.mode === "cross_modal" ? "ANALYZED" : "NOT EVALUATED"],
    [t("report.evidenceType"), evidenceType(report)],
  ];

  return (
    <ReportSection title={t("report.trustEvidence")} label="Conservative state">
      <div className="analysis-report-trust-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </ReportSection>
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

function EvidenceMetric({ label, value }: { label: string; value: string }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="analysis-report-mini-list">
      <strong>{title}</strong>
      <ul>
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function executiveSummary(report: ReportInput) {
  if (report.mode === "grounding") {
    const count = report.boundingBoxes?.length ?? 0;
    return `${count} localized ${count === 1 ? "region was" : "regions were"} returned for the grounding request. ${sentenceSummary(report.finalAnswer)}`;
  }

  if (report.mode === "temporal") {
    return sentenceSummary(report.changeAnalysis?.summary || report.finalAnswer);
  }

  if (report.mode === "cross_modal") {
    return sentenceSummary(report.finalAnswer);
  }

  return sentenceSummary(report.finalAnswer);
}

function sentenceSummary(value: string) {
  const sentences = value
    .replace(/\*\*/g, "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 4);

  return sentences.join(" ") || "No summary text was available.";
}

function modeLabel(report: ReportInput) {
  if (report.mode === "grounding") {
    return "Visual Grounding";
  }
  if (report.mode === "temporal") {
    return "Temporal Change";
  }
  if (report.mode === "cross_modal") {
    return "Optical + SAR";
  }
  return "Scene Analysis";
}

function evidenceType(report: ReportInput) {
  if (report.mode === "grounding" && (report.boundingBoxes?.length ?? 0) > 0) {
    return "GROUNDING EVIDENCE";
  }

  const guard = report.changeAnalysis?.change_guard;
  if (guard?.qwen_called === false || guard?.semantic_verification === "deterministic_no_change") {
    return "DETERMINISTIC EVIDENCE";
  }

  if (report.mode === "temporal" && guard?.status === "measurable_difference") {
    return "MODEL INTERPRETATION";
  }

  return "MODEL INTERPRETATION";
}

function changeGuardReportStatus(guard: ChangeGuardPayload) {
  switch (guard.status) {
    case "no_measurable_change":
      return "NO MEASURABLE CHANGE";
    case "measurable_difference":
      return "VISIBLE CHANGE DETECTED";
    case "incompatible":
      return "ERROR";
    default:
      return guard.status?.replace(/_/g, " ").toUpperCase() || "NOT EVALUATED";
  }
}

function limitationsForReport(report: ReportInput) {
  const customLimitations = report.changeAnalysis?.limitations ?? [];

  if (report.mode === "temporal") {
    return [
      ...customLimitations,
      "The semantic change description is AI-generated when Qwen is called.",
      "Dimension normalization is not geospatial registration.",
      "Image-space changed-pixel fraction does not equal changed ground area.",
      "Season, illumination, cloud, viewing conditions, resolution, or image quality may influence interpretation.",
    ];
  }

  if (report.mode === "cross_modal") {
    return [
      "Cross-sensor interpretation may require expert verification.",
      "The current Optical + SAR pipeline does not prove geospatial co-registration unless such metadata is explicitly available.",
      "Semantic output is AI-generated and not independently verified.",
    ];
  }

  if (report.mode === "grounding") {
    return [
      "Grounding boxes are localized model outputs and should be visually reviewed.",
      "A returned bounding box is not independent scientific verification.",
    ];
  }

  return ["AI-generated interpretation — not independently verified."];
}

function observabilityLabel(value?: string) {
  switch (value) {
    case "clearly_visible":
      return "Clearly visible";
    case "possible":
      return "Possible change";
    case "not_reliably_observable":
      return "Not reliably observable";
    default:
      return value ? value.replace(/_/g, " ") : "";
  }
}
