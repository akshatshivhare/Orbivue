import type { BoundingBox, ChangeAnalysisPayload, TemporalMessageImage } from "../workspaceTypes";

export type ReportMode = "analysis" | "grounding" | "temporal";

export type ReportImage = {
  name: string;
  url: string;
  label?: string;
};

export type ReportInput = {
  mode: ReportMode;
  query?: string;
  finalAnswer: string;
  boundingBoxes?: BoundingBox[];
  sourceImage?: ReportImage | null;
  beforeImage?: TemporalMessageImage | null;
  afterImage?: TemporalMessageImage | null;
  generatedAt?: Date | string;
  changeAnalysis?: ChangeAnalysisPayload | null;
};

export type SummaryCard = {
  label: string;
  value: string;
  note?: string;
};

export type ChartDatum = {
  label: string;
  value: number;
};

export type Finding = {
  label: string;
  text: string;
};

const SINGLE_IMAGE_CATEGORIES = [
  { label: "Buildings", terms: ["building", "buildings", "built-up", "urban"] },
  { label: "Roads", terms: ["road", "roads", "roadway", "street", "highway"] },
  { label: "Water", terms: ["water", "river", "lake", "pond", "coast", "shore"] },
  { label: "Vegetation", terms: ["vegetation", "trees", "forest", "greenery", "grass"] },
  { label: "Vehicles", terms: ["vehicle", "vehicles", "car", "cars", "truck"] },
  { label: "Infrastructure", terms: ["infrastructure", "bridge", "rail", "airport", "utility"] },
  { label: "Terrain", terms: ["terrain", "slope", "mountain", "hill", "landform"] },
  { label: "Agriculture", terms: ["agriculture", "field", "fields", "farm", "crop", "crops"] },
];

const TEMPORAL_CATEGORIES = [
  { label: "Construction", terms: ["construction", "construction site", "developed"] },
  { label: "Buildings", terms: ["building", "buildings", "built-up", "urban"] },
  { label: "Roads", terms: ["road", "roads", "roadway", "street", "highway"] },
  { label: "Vegetation", terms: ["vegetation", "trees", "forest", "greenery", "grass"] },
  { label: "Water", terms: ["water", "river", "lake", "pond", "coast", "shore"] },
  { label: "Infrastructure", terms: ["infrastructure", "bridge", "rail", "airport", "utility"] },
  { label: "Parking", terms: ["parking", "parking lot"] },
  { label: "Demolition", terms: ["demolition", "demolished", "removed", "disappeared"] },
  { label: "Other", terms: ["change", "modified", "difference"] },
];

export function formatGeneratedAt(value: Date | string | undefined): string {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function reportTypeLabel(mode: ReportMode): string {
  if (mode === "grounding") {
    return "Visual Grounding";
  }

  if (mode === "temporal") {
    return "Temporal Change";
  }

  return "Single Image";
}

export function buildSummaryCards(report: ReportInput): SummaryCard[] {
  if (report.mode === "temporal") {
    const changeCategories = explicitTemporalCategoryCounts(report).length;
    return [
      { label: "Analysis Type", value: "Temporal Change" },
      { label: "Images Compared", value: "2" },
      { label: "Change Categories", value: String(changeCategories), note: "Explicitly derived" },
    ];
  }

  if (report.mode === "grounding") {
    const verifiedRegions = report.boundingBoxes?.length ?? 0;
    return [
      { label: "Analysis Type", value: "Visual Grounding" },
      { label: "Images Analyzed", value: "1" },
      { label: "Verified Regions", value: String(verifiedRegions) },
    ];
  }

  const findings = explicitSingleImageCategoryCounts(report).reduce((total, item) => total + item.value, 0);
  return [
    { label: "Analysis Type", value: "Single Image" },
    { label: "Images Analyzed", value: "1" },
    { label: "Findings", value: String(findings), note: "Explicitly parsed" },
  ];
}

export function chartTitleForMode(mode: ReportMode): string {
  if (mode === "temporal") {
    return "Detected Change Findings";
  }

  if (mode === "grounding") {
    return "Detected Regions";
  }

  return "Observable Finding Counts";
}

export function chartDataForReport(report: ReportInput): ChartDatum[] {
  if (report.mode === "grounding") {
    return explicitGroundingCounts(report.boundingBoxes ?? []);
  }

  if (report.mode === "temporal") {
    return explicitTemporalCategoryCounts(report);
  }

  return explicitSingleImageCategoryCounts(report);
}

export function findingsForReport(report: ReportInput): Finding[] {
  if (report.mode === "grounding") {
    const boxes = report.boundingBoxes ?? [];
    if (!boxes.length) {
      return [{ label: "Detection summary", text: "No verified regions were returned for this grounding request." }];
    }

    return boxes.map((box, index) => ({
      label: box.label || `Region ${index + 1}`,
      text: `Region ${index + 1} is available for visual inspection in the source image overlay.`,
    }));
  }

  if (report.mode === "temporal" && report.changeAnalysis?.changes.length) {
    return report.changeAnalysis.changes.map((change) => ({
      label: change.category,
      text: change.description,
    }));
  }

  return splitAnswerIntoFindings(report.finalAnswer).map((text, index) => ({
    label: `Finding ${index + 1}`,
    text,
  }));
}

function explicitGroundingCounts(boxes: BoundingBox[]): ChartDatum[] {
  const counts = new Map<string, number>();

  boxes.forEach((box) => {
    const label = (box.label || "Region").trim() || "Region";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return Array.from(counts, ([label, value]) => ({ label, value }));
}

function explicitTemporalCategoryCounts(report: ReportInput): ChartDatum[] {
  if (report.changeAnalysis?.changes.length) {
    const counts = new Map<string, number>();

    report.changeAnalysis.changes.forEach((change) => {
      const label = normalizeKnownCategory(change.category, TEMPORAL_CATEGORIES) || "Other";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });

    return Array.from(counts, ([label, value]) => ({ label, value }));
  }

  return countCategoriesFromText(report.finalAnswer, TEMPORAL_CATEGORIES);
}

function explicitSingleImageCategoryCounts(report: ReportInput): ChartDatum[] {
  return countCategoriesFromText(report.finalAnswer, SINGLE_IMAGE_CATEGORIES);
}

function countCategoriesFromText(
  text: string,
  categories: Array<{ label: string; terms: string[] }>
): ChartDatum[] {
  const lowerText = text.toLowerCase();

  return categories.flatMap((category) => {
    const value = category.terms.reduce((count, term) => {
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matches = lowerText.match(new RegExp(`\\b${escapedTerm}\\b`, "g"));
      return count + (matches?.length ?? 0);
    }, 0);

    return value > 0 ? [{ label: category.label, value }] : [];
  });
}

function normalizeKnownCategory(
  value: string,
  categories: Array<{ label: string; terms: string[] }>
): string | null {
  const lowerValue = value.toLowerCase();
  const match = categories.find(
    (category) =>
      category.label.toLowerCase() === lowerValue ||
      category.terms.some((term) => lowerValue.includes(term))
  );

  return match?.label ?? (value.trim() || null);
}

function splitAnswerIntoFindings(answer: string): string[] {
  const bulletFindings = answer
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.\s]+/, "").trim())
    .filter(Boolean);

  if (bulletFindings.length > 1) {
    return bulletFindings.slice(0, 6);
  }

  return answer
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 5);
}
