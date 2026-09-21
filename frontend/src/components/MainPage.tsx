import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  BrainCircuit,
  FileText,
  Globe2,
  Menu,
  Mountain,
  Moon,
  Radar,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react";
import orbivueEarth from "../assets/orbivue-earth.png";
import orbivueSatellite from "../assets/orbivue-satellite.png";
import { apiUrl } from "../config/api";
import { ChatWorkspace } from "./ChatWorkspace";
import { OrbivueLogo } from "./OrbivueLogo";
import { ReportPreviewModal } from "./report/ReportPreviewModal";
import type { ReportInput } from "./report/reportUtils";
import { SatelliteExplorer } from "./SatelliteExplorer";
import type {
  AnalysisMode,
  BoundingBox,
  ChangeAnalysisPayload,
  ChangeDirection,
  ChangeGuardPayload,
  ChangeItem,
  ChatMessage,
  CompareMode,
  CrossModalImagePreviews,
  CrossModalImageSlot,
  CrossModalImageState,
  SatelliteImageryMetadata,
  TemporalImagePreviews,
  TemporalImageryMetadata,
  TemporalImageSlot,
  TemporalImageState,
} from "./workspaceTypes";

const MAX_ANALYSIS_IMAGE_SIDE = 1280;
const ANALYSIS_IMAGE_QUALITY = 0.86;
const SINGLE_ANALYSIS_ENDPOINT = apiUrl("/api/analyze");
const CHANGE_ANALYSIS_ENDPOINT = apiUrl("/api/change-analyze");
const CROSS_MODAL_ENDPOINT = apiUrl("/api/cross-modal");
const DEBUG_LOGS = import.meta.env.DEV;
const THEME_STORAGE_KEY = "orbivue-theme";
const GLOBAL_LIMIT_FRIENDLY_MESSAGE = "Today's demo analysis limit has been reached. Please try again tomorrow.";
const CLIENT_LIMIT_FRIENDLY_MESSAGE = "You've reached today's analysis limit. Please try again tomorrow.";

type ApiStatus = "connecting" | "connected" | "unavailable";
type ThemeMode = "dark" | "light";
type NavSection = "ask" | "satellite" | "intelligence" | "reports" | "watch" | "terrain" | "evaluation";
type ApiResponseShape = {
  detail?: string;
  final_answer?: string;
};

type TrustRow = {
  label: string;
  value: string;
  tone?: "neutral" | "ready" | "info" | "warning" | "error";
  detail?: string;
  icon: LucideIcon;
};

type TrustPanelModel = {
  overallState: string;
  overallTone: TrustRow["tone"];
  summary: string;
  rows: TrustRow[];
};

const navItems: Array<{
  id: NavSection;
  label: string;
  icon: LucideIcon;
  comingSoon?: boolean;
}> = [
  { id: "ask", label: "Ask ORBIVUE", icon: Sparkles },
  { id: "satellite", label: "Satellite Explorer", icon: Globe2 },
  { id: "watch", label: "Watch Areas", icon: Bell, comingSoon: true },
  { id: "intelligence", label: "Intelligence", icon: BrainCircuit },
  { id: "terrain", label: "3D Terrain", icon: Mountain, comingSoon: true },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "evaluation", label: "Evaluation", icon: ShieldCheck, comingSoon: true },
];

type MainPageProps = {
  userName?: string;
};

function debugLog(...args: unknown[]) {
  if (DEBUG_LOGS) {
    console.log(...args);
  }
}

function friendlyAnalysisError(response: Response, data: ApiResponseShape | null, fallback: string) {
  if (response.status === 429) {
    const detail = typeof data?.detail === "string" ? data.detail : "";
    return detail.toLowerCase().includes("device/network")
      ? CLIENT_LIMIT_FRIENDLY_MESSAGE
      : GLOBAL_LIMIT_FRIENDLY_MESSAGE;
  }

  return data?.detail || data?.final_answer || fallback;
}

function friendlyCaughtError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const normalized = error.message.toLowerCase();
  if (normalized.includes("timeout")) {
    return "The satellite AI is taking longer than expected to start. Please retry in a moment.";
  }
  if (error.message === CLIENT_LIMIT_FRIENDLY_MESSAGE || error.message === GLOBAL_LIMIT_FRIENDLY_MESSAGE) {
    return error.message;
  }

  return fallback;
}

function getInitialTheme(): ThemeMode {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (savedTheme === "dark" || savedTheme === "light") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

async function compressImageForAnalysis(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type.includes("tiff")) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.decoding = "async";

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to prepare image for analysis."));
      image.src = objectUrl;
    });

    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = longestSide > MAX_ANALYSIS_IMAGE_SIDE ? MAX_ANALYSIS_IMAGE_SIDE / longestSide : 1;
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    if (scale === 1 && file.size <= 1_500_000) {
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", ANALYSIS_IMAGE_QUALITY);
    });

    if (!blob) {
      return file;
    }

    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function normalizeSingleBox(rawBox: unknown, fallbackLabel: string): BoundingBox | null {
  if (!Array.isArray(rawBox) || rawBox.length !== 4) {
    return null;
  }

  const normalizedBox = rawBox.map((value) => Number(value));
  if (normalizedBox.some((value) => Number.isNaN(value))) {
    return null;
  }

  const [rawYMin, rawXMin, rawYMax, rawXMax] = normalizedBox;
  const ymin = Math.max(0, Math.min(1, Math.min(rawYMin, rawYMax)));
  const xmin = Math.max(0, Math.min(1, Math.min(rawXMin, rawXMax)));
  const ymax = Math.max(0, Math.min(1, Math.max(rawYMin, rawYMax)));
  const xmax = Math.max(0, Math.min(1, Math.max(rawXMin, rawXMax)));

  if (ymax <= ymin || xmax <= xmin) {
    return null;
  }

  return {
    label: fallbackLabel,
    box: [ymin, xmin, ymax, xmax],
  };
}

function normalizeBoundingBoxes(rawBoxes: unknown): BoundingBox[] {
  const directBox = normalizeSingleBox(rawBoxes, "region");
  if (directBox) {
    return [directBox];
  }

  if (!Array.isArray(rawBoxes)) {
    return [];
  }

  return rawBoxes.flatMap((item, index) => {
    if (Array.isArray(item)) {
      const box = normalizeSingleBox(item, `region ${index + 1}`);
      return box ? [box] : [];
    }

    if (!item || typeof item !== "object") {
      return [];
    }

    const candidate = item as {
      label?: unknown;
      box?: unknown;
      bbox?: unknown;
      bounding_box?: unknown;
    };
    const rawBox = candidate.box ?? candidate.bbox ?? candidate.bounding_box;
    const normalizedBox = normalizeSingleBox(rawBox, String(candidate.label || `region ${index + 1}`));
    return normalizedBox ? [normalizedBox] : [];
  });
}

function fileKey(file: File | null) {
  return file ? `${file.name}:${file.size}:${file.lastModified}` : "";
}

function buildTemporalPairKey(t1: File | null, t2: File | null) {
  if (!t1 || !t2) {
    return "";
  }

  return `${fileKey(t1)}::${fileKey(t2)}`;
}

function buildCrossModalPairKey(optical: File | null, sar: File | null) {
  if (!optical || !sar) {
    return "";
  }

  return `${fileKey(optical)}::${fileKey(sar)}`;
}

function normalizeTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) {
      return [item.trim()];
    }

    return [];
  });
}

function normalizeOptionalNumber(value: unknown): number | null {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function normalizeOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeSizeTuple(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  const width = Number(value[0]);
  const height = Number(value[1]);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }

  return [width, height];
}

function normalizeChangeGuard(value: unknown): ChangeGuardPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;

  return {
    status: normalizeOptionalString(source.status) ?? undefined,
    qwen_called: normalizeOptionalBoolean(source.qwen_called),
    exact_match: normalizeOptionalBoolean(source.exact_match),
    mean_absolute_difference: normalizeOptionalNumber(source.mean_absolute_difference),
    changed_pixel_fraction: normalizeOptionalNumber(source.changed_pixel_fraction),
    pixel_change_threshold: normalizeOptionalNumber(source.pixel_change_threshold),
    near_identical_mean_threshold: normalizeOptionalNumber(source.near_identical_mean_threshold),
    near_identical_fraction_threshold: normalizeOptionalNumber(source.near_identical_fraction_threshold),
    semantic_verification: normalizeOptionalString(source.semantic_verification) ?? undefined,
    dimension_normalized: normalizeOptionalBoolean(source.dimension_normalized),
    original_size_t1: normalizeSizeTuple(source.original_size_t1),
    original_size_t2: normalizeSizeTuple(source.original_size_t2),
    comparison_size: normalizeSizeTuple(source.comparison_size),
    normalization_method: normalizeOptionalString(source.normalization_method),
    aspect_ratio_t1: normalizeOptionalNumber(source.aspect_ratio_t1),
    aspect_ratio_t2: normalizeOptionalNumber(source.aspect_ratio_t2),
    aspect_ratio_relative_difference: normalizeOptionalNumber(source.aspect_ratio_relative_difference),
    alignment_warning: normalizeOptionalString(source.alignment_warning),
  };
}

function normalizeChangeItems(value: unknown): ChangeItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const candidate = item as {
      category?: unknown;
      direction?: unknown;
      description?: unknown;
      confidence?: unknown;
    };
    const description =
      typeof candidate.description === "string" && candidate.description.trim()
        ? candidate.description.trim()
        : "";

    if (!description) {
      return [];
    }

    const rawConfidence = Number(candidate.confidence);
    const confidence = Number.isFinite(rawConfidence) ? rawConfidence : null;

    return [
      {
        category:
          typeof candidate.category === "string" && candidate.category.trim()
            ? candidate.category.trim()
            : "Change",
        direction:
          typeof candidate.direction === "string" && candidate.direction.trim()
            ? (candidate.direction.trim() as ChangeDirection)
            : "uncertain",
        description,
        confidence,
      },
    ];
  });
}

function normalizeChangeAnalysisResponse(data: unknown): ChangeAnalysisPayload {
  const source = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const mode = source.mode === "change_vqa" ? "change_vqa" : "change_analysis";
  const summary = typeof source.summary === "string" ? source.summary.trim() : "";
  const finalAnswer =
    typeof source.final_answer === "string" && source.final_answer.trim()
      ? source.final_answer.trim()
      : summary || "Temporal change analysis completed.";

  return {
    mode,
    summary: summary || finalAnswer,
    final_answer: finalAnswer,
    changes: normalizeChangeItems(source.changes),
    unchanged: normalizeTextArray(source.unchanged),
    limitations: normalizeTextArray(source.limitations),
    change_map: typeof source.change_map === "string" ? source.change_map : null,
    change_guard: normalizeChangeGuard(source.change_guard),
  };
}

function normalizeCrossModalResponse(data: unknown) {
  const source = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const finalAnswer =
    typeof source.final_answer === "string" && source.final_answer.trim()
      ? source.final_answer.replace(/\\n/g, "\n").replace(/\*\*/g, "").trim()
      : "Cross-modal analysis completed.";

  return {
    mode: "cross_modal" as const,
    final_answer: finalAnswer,
  };
}

function apiStatusLabel(status: ApiStatus) {
  if (status === "connected") {
    return "Connected";
  }

  if (status === "unavailable") {
    return "Unavailable";
  }

  return "Connecting";
}

function activeNavSection(isSatelliteExplorerOpen: boolean, isCompareWorkflow: boolean): NavSection {
  if (isSatelliteExplorerOpen) {
    return "satellite";
  }

  if (isCompareWorkflow) {
    return "intelligence";
  }

  return "ask";
}

function trustModeLabel(report: ReportInput | null, isCompareWorkflow: boolean, compareMode: CompareMode, query: string) {
  if (isCompareWorkflow) {
    return compareMode === "cross_modal" ? "OPTICAL + SAR" : "TEMPORAL CHANGE";
  }

  if (report?.mode === "grounding") {
    return "VISUAL GROUNDING";
  }

  if (report?.mode === "temporal") {
    return "TEMPORAL CHANGE";
  }

  if (report?.mode === "cross_modal") {
    return "OPTICAL + SAR";
  }

  if (report?.mode === "analysis" || query.trim()) {
    return /\b(where|locate|find|highlight|detect|show|ground)\b/i.test(query)
      ? "VISUAL GROUNDING"
      : "SCENE ANALYSIS";
  }

  return "NOT SELECTED";
}

function changeGuardTrustLabel(guard?: ChangeGuardPayload | null) {
  if (!guard?.status) {
    return "NOT EVALUATED";
  }

  switch (guard.status) {
    case "no_measurable_change":
      return "NO MEASURABLE CHANGE";
    case "measurable_difference":
      return "VISIBLE CHANGE DETECTED";
    case "incompatible":
      return "ERROR";
    default:
      return guard.status.replace(/_/g, " ").toUpperCase();
  }
}

function changeGuardDetail(guard?: ChangeGuardPayload | null) {
  if (!guard?.status) {
    return undefined;
  }

  if (guard.qwen_called === false || guard.semantic_verification === "deterministic_no_change") {
    return "DETERMINISTIC CHECK";
  }

  if (guard.qwen_called === true || guard.semantic_verification === "model_generated_unverified") {
    return "AI INTERPRETATION";
  }

  return undefined;
}

function evidenceState(report: ReportInput | null) {
  if (!report) {
    return {
      value: "NO EVIDENCE YET",
      detail: "Run an analysis to populate evidence.",
      tone: "neutral" as const,
    };
  }

  if (report.mode === "grounding") {
    const count = report.boundingBoxes?.length ?? 0;
    return {
      value: count > 0 ? "GROUNDING EVIDENCE" : "NO EVIDENCE YET",
      detail: count > 0 ? `${count} localized ${count === 1 ? "region" : "regions"} returned.` : "No localized regions returned.",
      tone: count > 0 ? ("ready" as const) : ("neutral" as const),
    };
  }

  if (report.mode === "temporal") {
    const guard = report.changeAnalysis?.change_guard;
    if (!guard) {
      return {
        value: "MODEL INTERPRETATION",
        detail: "Temporal result is AI-generated and not independently verified.",
        tone: "warning" as const,
      };
    }

    if (guard.qwen_called === false || guard.semantic_verification === "deterministic_no_change") {
      return {
        value: "DETERMINISTIC EVIDENCE",
        detail: "Exact/near-identical imagery detected.",
        tone: "ready" as const,
      };
    }

    if (guard.status === "measurable_difference" && typeof guard.changed_pixel_fraction === "number") {
      return {
        value: "DETERMINISTIC EVIDENCE",
        detail: "Image-space difference metrics returned.",
        tone: "ready" as const,
      };
    }

    return {
      value: "MODEL INTERPRETATION",
      detail: "Result is AI-generated and not independently verified.",
      tone: "warning" as const,
    };
  }

  return {
    value: "MODEL INTERPRETATION",
    detail: "Result is AI-generated and not independently verified.",
    tone: "warning" as const,
  };
}

function readableStatus(value: string) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bSar\b/g, "SAR")
    .replace(/\bAi\b/g, "AI");
}

function buildTrustPanelModel({
  selectedImage,
  hasTemporalImage,
  hasCrossModalImage,
  latestReport,
  isCompareWorkflow,
  compareMode,
  query,
  error,
  isBusy,
}: {
  selectedImage: File | null;
  hasTemporalImage: boolean;
  hasCrossModalImage: boolean;
  latestReport: ReportInput | null;
  isCompareWorkflow: boolean;
  compareMode: CompareMode;
  query: string;
  error: string;
  isBusy: boolean;
}): TrustPanelModel {
  const latestGuard = latestReport?.mode === "temporal" ? latestReport.changeAnalysis?.change_guard : null;
  const hasInput = Boolean(selectedImage || hasTemporalImage || hasCrossModalImage);
  const hasCrossModalResult = latestReport?.mode === "cross_modal";
  const hasRequestError = Boolean(error && !isBusy);
  const modeLabel = trustModeLabel(latestReport, isCompareWorkflow, compareMode, query);
  const evidence = evidenceState(latestReport);
  const overallState = (() => {
    if (hasRequestError) {
      return "REVIEW ADVISED";
    }

    if (isBusy || (hasInput && !latestReport)) {
      return "READY FOR ANALYSIS";
    }

    if (latestReport?.mode === "grounding" && (latestReport.boundingBoxes?.length ?? 0) > 0) {
      return "EVIDENCE AVAILABLE";
    }

    if (latestReport?.mode === "temporal" && latestGuard) {
      return latestGuard.qwen_called === false || latestGuard.semantic_verification === "deterministic_no_change"
        ? "EVIDENCE AVAILABLE"
        : "REVIEW ADVISED";
    }

    if (latestReport?.mode === "cross_modal") {
      return "REVIEW ADVISED";
    }

    if (latestReport?.mode === "analysis") {
      return "ANALYSIS COMPLETE";
    }

    return "NO INPUT";
  })();
  const overallTone: TrustRow["tone"] =
    overallState === "EVIDENCE AVAILABLE" || overallState === "ANALYSIS COMPLETE"
      ? "ready"
      : overallState === "READY FOR ANALYSIS"
        ? "info"
        : overallState === "REVIEW ADVISED"
          ? "warning"
          : "neutral";

  return {
    overallState,
    overallTone,
    summary: `Mode: ${readableStatus(modeLabel)} • Evidence: ${readableStatus(evidence.value)}`,
    rows: [
      {
        label: "Input Validation",
        value: hasInput ? "INPUT READY" : "NOT EVALUATED",
        tone: hasInput ? "ready" : "neutral",
        detail: hasInput ? "Supported imagery attached." : "Attach imagery to begin.",
        icon: ShieldCheck,
      },
      {
        label: "Analysis Mode",
        value: modeLabel,
        tone: modeLabel === "NOT SELECTED" ? "neutral" : "info",
        detail: "Derived from the active workspace.",
        icon: BrainCircuit,
      },
      {
        label: "ChangeGuard",
        value: changeGuardTrustLabel(latestGuard),
        tone:
          latestGuard?.status === "incompatible"
            ? "error"
            : latestGuard?.status === "measurable_difference"
              ? "warning"
              : latestGuard?.status
                ? "ready"
                : "neutral",
        detail: changeGuardDetail(latestGuard),
        icon: Activity,
      },
      {
        label: "Cross-Sensor Check",
        value:
          hasRequestError && isCompareWorkflow && compareMode === "cross_modal"
            ? "ERROR"
            : hasCrossModalResult
              ? "ANALYZED"
              : "NOT EVALUATED",
        tone:
          hasRequestError && isCompareWorkflow && compareMode === "cross_modal"
            ? "error"
            : hasCrossModalResult
              ? "info"
              : "neutral",
        detail: hasCrossModalResult ? "Optical and SAR evidence processed together." : undefined,
        icon: Radar,
      },
      {
        label: "Evidence",
        value: evidence.value,
        tone: evidence.tone,
        detail: evidence.detail,
        icon: Globe2,
      },
    ],
  };
}

function OrbivueSidebar({
  activeSection,
  isOpen,
  onClose,
  onNewChat,
  onNavigate,
}: {
  activeSection: NavSection;
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onNavigate: (section: NavSection) => void;
}) {
  return (
    <aside className={`orbivue-side-nav ${isOpen ? "is-open" : ""}`}>
      <div className="orbivue-side-brand">
        <div className="orbivue-side-logo-crop">
          <OrbivueLogo className="orbivue-side-logo" />
        </div>
        <button type="button" className="orbivue-side-close" onClick={onClose} aria-label="Close navigation">
          <X size={18} />
        </button>
        <div>
          <strong>ORBIVUE</strong>
          <span>Earth Intelligence</span>
        </div>
      </div>

      <button type="button" className="orbivue-new-chat" onClick={onNewChat}>
        <Sparkles size={16} />
        New analysis
      </button>

      <nav className="orbivue-nav-list" aria-label="ORBIVUE workspace navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (!item.comingSoon) {
                  onNavigate(item.id);
                }
              }}
              disabled={item.comingSoon}
              className={`orbivue-nav-item ${isActive ? "is-active" : ""}`}
              title={item.comingSoon ? `${item.label} coming soon` : item.label}
            >
              <Icon size={17} />
              <span>{item.label}</span>
              {item.comingSoon && <em>Coming Soon</em>}
            </button>
          );
        })}
      </nav>

      <div className="orbivue-side-note">
        <Radar size={16} />
        <span>Verification states appear only when supported by the active pipeline.</span>
      </div>
    </aside>
  );
}

function OrbivueHero() {
  return (
    <section className="orbivue-hero-panel">
      <div className="orbivue-hero-copy">
        <span>ORBIVUE</span>
        <h2>
          Earth
          <br />
          Intelligence
          <br />
          You
          <br />
          Can Verify
        </h2>
        <p>Analyze geospatial imagery through evidence-backed Earth intelligence.</p>
      </div>
      <div className="orbivue-hero-visual" aria-hidden="true">
        <img src={orbivueEarth} alt="" className="orbivue-hero-earth" />
        <img src={orbivueSatellite} alt="" className="orbivue-hero-satellite" />
      </div>
    </section>
  );
}

function TrustPanel({ model }: { model: TrustPanelModel }) {
  return (
    <aside className="orbivue-trust-panel">
      <div className="orbivue-trust-header">
        <span>ORBIVUE TRUST &amp; EVIDENCE</span>
        <ShieldCheck size={18} />
      </div>

      <div className={`orbivue-trust-state tone-${model.overallTone ?? "neutral"}`}>
        <p>Current State</p>
        <strong>{model.overallState}</strong>
        <small>{model.summary}</small>
      </div>

      <div className="orbivue-trust-rows">
        {model.rows.map((row) => {
          const Icon = row.icon;

          return (
            <article key={row.label} className={`orbivue-trust-row tone-${row.tone ?? "neutral"}`}>
              <Icon size={16} />
              <div>
                <span>{row.label}</span>
                {row.detail && <small>{row.detail}</small>}
              </div>
              <strong>{row.value}</strong>
            </article>
          );
        })}
      </div>

      <div className="orbivue-trust-footnote">
        <Activity size={15} />
        <p>Verification states are shown only when supported by the current analysis pipeline.</p>
      </div>
    </aside>
  );
}

export function MainPage({ userName = "Explorer" }: MainPageProps) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isChangeLoading, setIsChangeLoading] = useState(false);
  const [compareMode, setCompareMode] = useState<CompareMode>("temporal");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedImageMetadata, setSelectedImageMetadata] = useState<SatelliteImageryMetadata | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [temporalImages, setTemporalImages] = useState<TemporalImageState>({ t1: null, t2: null });
  const [temporalImageMetadata, setTemporalImageMetadata] = useState<TemporalImageryMetadata>({ t1: null, t2: null });
  const [temporalPreviewUrls, setTemporalPreviewUrls] = useState<TemporalImagePreviews>({ t1: "", t2: "" });
  const [crossModalImages, setCrossModalImages] = useState<CrossModalImageState>({ optical: null, sar: null });
  const [crossModalPreviewUrls, setCrossModalPreviewUrls] = useState<CrossModalImagePreviews>({
    optical: "",
    sar: "",
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [latestReport, setLatestReport] = useState<ReportInput | null>(null);
  const [activeReport, setActiveReport] = useState<ReportInput | null>(null);
  const [isReportEmptyStateOpen, setIsReportEmptyStateOpen] = useState(false);
  const [hasWorkspaceOpened, setHasWorkspaceOpened] = useState(false);
  const [isCompareWorkflow, setIsCompareWorkflow] = useState(false);
  const [isSatelliteExplorerOpen, setIsSatelliteExplorerOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus>("connecting");
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const submitLockRef = useRef(false);
  const changeSubmitLockRef = useRef(false);
  const temporalAttachSlotRef = useRef<TemporalImageSlot | "auto">("auto");
  const crossModalAttachSlotRef = useRef<CrossModalImageSlot | "auto">("auto");
  const analyzedPairRef = useRef<string | null>(null);
  const compressedImageRef = useRef<{ source: File; file: File } | null>(null);
  const compressedTemporalImagesRef = useRef<Partial<Record<TemporalImageSlot, { source: File; file: File }>>>({});
  const compressedCrossModalImagesRef = useRef<Partial<Record<CrossModalImageSlot, { source: File; file: File }>>>({});
  const messageImageUrlsRef = useRef<string[]>([]);

  const temporalPairKey = useMemo(
    () => buildTemporalPairKey(temporalImages.t1, temporalImages.t2),
    [temporalImages.t1, temporalImages.t2]
  );
  const hasTemporalImage = Boolean(temporalImages.t1 || temporalImages.t2);
  const hasTemporalPair = Boolean(temporalImages.t1 && temporalImages.t2);
  const hasCrossModalImage = Boolean(crossModalImages.optical || crossModalImages.sar);
  const isBusy = isLoading || isChangeLoading;
  const currentNavSection = activeNavSection(isSatelliteExplorerOpen, isCompareWorkflow);
  const trustPanelModel = buildTrustPanelModel({
    selectedImage,
    hasTemporalImage,
    hasCrossModalImage,
    latestReport,
    isCompareWorkflow,
    compareMode,
    query,
    error,
    isBusy,
  });
  const isWorkspaceMode =
    hasWorkspaceOpened ||
    query.trim().length > 0 ||
    selectedImage !== null ||
    (isCompareWorkflow && hasTemporalImage) ||
    (isCompareWorkflow && hasCrossModalImage) ||
    messages.length > 0;

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const controller = new AbortController();
    setApiStatus("connecting");

    fetch(apiUrl("/health"), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Health check failed.");
        }
        setApiStatus("connected");
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          debugLog("[OrbiVue API] health unavailable:", error);
          setApiStatus("unavailable");
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedImage) {
      setImagePreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedImage);
    setImagePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedImage]);

  useEffect(() => {
    const t1Url = temporalImages.t1 ? URL.createObjectURL(temporalImages.t1) : "";
    const t2Url = temporalImages.t2 ? URL.createObjectURL(temporalImages.t2) : "";

    setTemporalPreviewUrls({ t1: t1Url, t2: t2Url });

    return () => {
      if (t1Url) {
        URL.revokeObjectURL(t1Url);
      }
      if (t2Url) {
        URL.revokeObjectURL(t2Url);
      }
    };
  }, [temporalImages.t1, temporalImages.t2]);

  useEffect(() => {
    const opticalUrl = crossModalImages.optical ? URL.createObjectURL(crossModalImages.optical) : "";
    const sarUrl = crossModalImages.sar ? URL.createObjectURL(crossModalImages.sar) : "";

    setCrossModalPreviewUrls({ optical: opticalUrl, sar: sarUrl });

    return () => {
      if (opticalUrl) {
        URL.revokeObjectURL(opticalUrl);
      }
      if (sarUrl) {
        URL.revokeObjectURL(sarUrl);
      }
    };
  }, [crossModalImages.optical, crossModalImages.sar]);

  useEffect(() => {
    return () => {
      messageImageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      messageImageUrlsRef.current = [];
    };
  }, []);

  const createMessageImageUrl = (file: File | null) => {
    if (!file) {
      return "";
    }

    const objectUrl = URL.createObjectURL(file);
    messageImageUrlsRef.current.push(objectUrl);
    return objectUrl;
  };

  const clearMessageImageUrls = () => {
    messageImageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    messageImageUrlsRef.current = [];
  };

  const updateQuery = (value: string) => {
    setQuery(value);
    if (value.trim()) {
      setHasWorkspaceOpened(true);
    }
  };

  const selectImage = (file: File | null) => {
    if (!file) {
      return;
    }

    if (isCompareWorkflow && compareMode === "cross_modal") {
      const requestedSlot = crossModalAttachSlotRef.current;
      crossModalAttachSlotRef.current = "auto";
      const slot: CrossModalImageSlot =
        requestedSlot !== "auto" ? requestedSlot : !crossModalImages.optical ? "optical" : "sar";
      const nextCrossModalImages =
        slot === "optical"
          ? { optical: file, sar: crossModalImages.sar }
          : { optical: crossModalImages.optical, sar: file };

      setCrossModalImages(nextCrossModalImages);
      setError("");
      setLatestReport(null);
      setHasWorkspaceOpened(true);
      compressedCrossModalImagesRef.current[slot] = undefined;

      debugLog(`[OrbiVue CrossModal] ${slot === "optical" ? "Optical" : "SAR"} attached:`, file.name);
      debugLog("[OrbiVue CrossModal] pair ready:", Boolean(nextCrossModalImages.optical && nextCrossModalImages.sar));

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return;
    }

    if (!isCompareWorkflow) {
      setSelectedImage(file);
      setSelectedImageMetadata(null);
      setError("");
      setLatestReport(null);
      compressedImageRef.current = null;
      setHasWorkspaceOpened(true);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return;
    }

    const requestedSlot = temporalAttachSlotRef.current;
    temporalAttachSlotRef.current = "auto";
    const slot: TemporalImageSlot =
      requestedSlot !== "auto" ? requestedSlot : !temporalImages.t1 ? "t1" : !temporalImages.t2 ? "t2" : "t2";

    const nextTemporalImages =
      slot === "t1"
        ? { t1: file, t2: temporalImages.t2 }
        : { t1: temporalImages.t1 ?? file, t2: temporalImages.t1 ? file : null };

    setTemporalImages(nextTemporalImages);
    setTemporalImageMetadata(
      slot === "t1"
        ? { t1: null, t2: temporalImageMetadata.t2 }
        : { t1: temporalImageMetadata.t1, t2: null }
    );
    setSelectedImage(null);
    setSelectedImageMetadata(null);
    setError("");
    setLatestReport(null);
    compressedImageRef.current = null;
    compressedTemporalImagesRef.current[slot] = undefined;
    analyzedPairRef.current = null;

    debugLog(`[OrbiVue Change] ${slot === "t1" ? "T1 attached" : "T2 attached"}:`, file.name);
    debugLog("[OrbiVue Change] temporal mode active:", Boolean(nextTemporalImages.t1 && nextTemporalImages.t2));

    if (file) {
      setHasWorkspaceOpened(true);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    setSelectedImageMetadata(null);
    setError("");
    setLatestReport(null);
    compressedImageRef.current = null;

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const clearCrossModalImages = () => {
    setCrossModalImages({ optical: null, sar: null });
    setLatestReport(null);
    compressedCrossModalImagesRef.current = {};
    crossModalAttachSlotRef.current = "auto";
  };

  const removeTemporalImage = (slot: TemporalImageSlot) => {
    const nextTemporalImages =
      slot === "t1"
        ? { t1: temporalImages.t2, t2: null }
        : { t1: temporalImages.t1, t2: null };
    const nextTemporalMetadata =
      slot === "t1"
        ? { t1: temporalImageMetadata.t2, t2: null }
        : { t1: temporalImageMetadata.t1, t2: null };

    setTemporalImages(nextTemporalImages);
    setTemporalImageMetadata(nextTemporalMetadata);
    setError("");
    setLatestReport(null);
    compressedImageRef.current = null;
    compressedTemporalImagesRef.current = {};
    analyzedPairRef.current = null;

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeCrossModalImage = (slot: CrossModalImageSlot) => {
    const nextCrossModalImages =
      slot === "optical"
        ? { optical: null, sar: crossModalImages.sar }
        : { optical: crossModalImages.optical, sar: null };

    setCrossModalImages(nextCrossModalImages);
    setError("");
    setLatestReport(null);
    compressedCrossModalImagesRef.current[slot] = undefined;

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const replaceTemporalImage = (slot: TemporalImageSlot) => {
    temporalAttachSlotRef.current = slot;
    setCompareMode("temporal");
    setIsCompareWorkflow(true);
    setSelectedImage(null);
    setSelectedImageMetadata(null);
    setLatestReport(null);
    compressedImageRef.current = null;
    fileInputRef.current?.click();
  };

  const replaceCrossModalImage = (slot: CrossModalImageSlot) => {
    crossModalAttachSlotRef.current = slot;
    setCompareMode("cross_modal");
    setIsCompareWorkflow(true);
    setSelectedImage(null);
    setSelectedImageMetadata(null);
    setLatestReport(null);
    compressedImageRef.current = null;
    setHasWorkspaceOpened(true);
    fileInputRef.current?.click();
  };

  const swapTemporalImages = () => {
    if (!temporalImages.t1 || !temporalImages.t2 || isBusy) {
      return;
    }

    const nextTemporalImages = { t1: temporalImages.t2, t2: temporalImages.t1 };
    const nextTemporalMetadata = { t1: temporalImageMetadata.t2, t2: temporalImageMetadata.t1 };
    setTemporalImages(nextTemporalImages);
    setTemporalImageMetadata(nextTemporalMetadata);
    setError("");
    setLatestReport(null);
    compressedImageRef.current = null;
    compressedTemporalImagesRef.current = {};
    analyzedPairRef.current = null;
    setHasWorkspaceOpened(true);
    debugLog("[OrbiVue Change] temporal pair swapped");
  };

  const startNewChat = () => {
    clearMessageImageUrls();
    setMessages([]);
    setQuery("");
    setError("");
    clearSelectedImage();
    setTemporalImages({ t1: null, t2: null });
    setTemporalImageMetadata({ t1: null, t2: null });
    compressedTemporalImagesRef.current = {};
    analyzedPairRef.current = null;
    clearCrossModalImages();
    setCompareMode("temporal");
    setIsCompareWorkflow(false);
    setIsSatelliteExplorerOpen(false);
    setHasWorkspaceOpened(true);
    setIsSidebarOpen(false);
  };

  const openAskWorkflow = () => {
    setIsCompareWorkflow(false);
    setIsSatelliteExplorerOpen(false);
    setError("");
    setLatestReport(null);
    setHasWorkspaceOpened(true);
    setIsSidebarOpen(false);
  };

  const openCompareWorkflow = () => {
    setIsCompareWorkflow(true);
    setIsSatelliteExplorerOpen(false);
    setSelectedImage(null);
    setSelectedImageMetadata(null);
    compressedImageRef.current = null;
    setError("");
    setLatestReport(null);
    setHasWorkspaceOpened(true);
    setIsSidebarOpen(false);
  };

  const openLatestReportFromHome = () => {
    if (latestReport) {
      setActiveReport(latestReport);
      setIsReportEmptyStateOpen(false);
      return;
    }

    setIsReportEmptyStateOpen(true);
  };

  const openSatelliteExplorer = () => {
    setIsSatelliteExplorerOpen(true);
    setHasWorkspaceOpened(true);
    setError("");
    setIsSidebarOpen(false);
  };

  const useSatelliteSingleImage = (file: File, metadata: SatelliteImageryMetadata) => {
    setSelectedImage(file);
    setSelectedImageMetadata(metadata);
    setTemporalImages({ t1: null, t2: null });
    setTemporalImageMetadata({ t1: null, t2: null });
    compressedTemporalImagesRef.current = {};
    analyzedPairRef.current = null;
    setCompareMode("temporal");
    setIsCompareWorkflow(false);
    setIsSatelliteExplorerOpen(false);
    setQuery("");
    setError("");
    setLatestReport(null);
    compressedImageRef.current = null;
    setHasWorkspaceOpened(true);
  };

  const useSatelliteTemporalImages = (
    beforeFile: File,
    beforeMetadata: SatelliteImageryMetadata,
    afterFile: File,
    afterMetadata: SatelliteImageryMetadata
  ) => {
    setSelectedImage(null);
    setSelectedImageMetadata(null);
    compressedImageRef.current = null;
    setTemporalImages({ t1: beforeFile, t2: afterFile });
    setTemporalImageMetadata({ t1: beforeMetadata, t2: afterMetadata });
    compressedTemporalImagesRef.current = {};
    analyzedPairRef.current = null;
    setCompareMode("temporal");
    setIsCompareWorkflow(true);
    setIsSatelliteExplorerOpen(false);
    setQuery("");
    setError("");
    setLatestReport(null);
    setHasWorkspaceOpened(true);
  };

  const closeReportPreview = () => {
    setActiveReport(null);
    setIsReportEmptyStateOpen(false);
  };

  const returnToAskOrbiVue = () => {
    setIsReportEmptyStateOpen(false);
    setHasWorkspaceOpened(true);
  };

  const openRecentChat = (title: string, subtitle: string) => {
    setMessages([
      {
        id: `recent-user-${Date.now()}`,
        role: "user",
        text: title,
      },
      {
        id: `recent-assistant-${Date.now()}`,
        role: "assistant",
        text: `${subtitle} is ready to continue. Attach a fresh satellite image and ask your next question to run live analysis.`,
        mode: "analysis",
        boundingBoxes: [],
      },
    ]);
    setQuery("");
    setError("");
    setLatestReport(null);
    setHasWorkspaceOpened(true);
    setIsSidebarOpen(false);
  };

  const getCompressedTemporalImage = async (slot: TemporalImageSlot, file: File) => {
    const cached = compressedTemporalImagesRef.current[slot];

    if (cached?.source === file) {
      return cached.file;
    }

    const compressed = await compressImageForAnalysis(file);
    compressedTemporalImagesRef.current[slot] = {
      source: file,
      file: compressed,
    };
    return compressed;
  };

  const getCompressedCrossModalImage = async (slot: CrossModalImageSlot, file: File) => {
    const cached = compressedCrossModalImagesRef.current[slot];

    if (cached?.source === file) {
      return cached.file;
    }

    const compressed = await compressImageForAnalysis(file);
    compressedCrossModalImagesRef.current[slot] = {
      source: file,
      file: compressed,
    };
    return compressed;
  };

  const runCrossModalAnalysis = async (crossModalQuery: string) => {
    const trimmedQuery = crossModalQuery.trim();

    if (submitLockRef.current || isBusy) {
      return;
    }

    if (!crossModalImages.optical) {
      setError("Upload an optical image to continue.");
      return;
    }

    if (!crossModalImages.sar) {
      setError("Upload a SAR image to continue.");
      return;
    }

    if (!trimmedQuery) {
      return;
    }

    submitLockRef.current = true;
    setIsLoading(true);
    setError("");
    setLatestReport(null);
    setHasWorkspaceOpened(true);

    const currentOpticalUrl = crossModalPreviewUrls.optical;
    const currentSarUrl = crossModalPreviewUrls.sar;
    const currentOpticalName = crossModalImages.optical.name;
    const currentSarName = crossModalImages.sar.name;
    const submittedCrossModalImages = {
      optical: {
        name: currentOpticalName,
        url: createMessageImageUrl(crossModalImages.optical),
        label: "OPTICAL / MULTISPECTRAL",
      },
      sar: {
        name: currentSarName,
        url: createMessageImageUrl(crossModalImages.sar),
        label: "SAR / RADAR",
      },
    };

    setMessages((current) => [
      ...current,
      {
        id: `user-cross-modal-${Date.now()}`,
        role: "user",
        text: trimmedQuery,
        imageName: "Optical + SAR image pair",
        crossModalImages: submittedCrossModalImages,
      },
    ]);

    try {
      debugLog("[OrbiVue CrossModal] submitting analysis");
      debugLog("[OrbiVue CrossModal] endpoint:", CROSS_MODAL_ENDPOINT);

      const [opticalImage, sarImage] = await Promise.all([
        getCompressedCrossModalImage("optical", crossModalImages.optical),
        getCompressedCrossModalImage("sar", crossModalImages.sar),
      ]);
      const formData = new FormData();

      formData.append("optical_image", opticalImage, opticalImage.name);
      formData.append("sar_image", sarImage, sarImage.name);
      formData.append("query", trimmedQuery);

      const response = await fetch(CROSS_MODAL_ENDPOINT, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      debugLog("[OrbiVue CrossModal] response:", data);

      if (!response.ok) {
        throw new Error(friendlyAnalysisError(response, data, "Cross-modal analysis request failed."));
      }

      const crossModalAnalysis = normalizeCrossModalResponse(data);
      const generatedAt = new Date().toISOString();
      const crossModalMessageImages = {
        optical: {
          name: currentOpticalName,
          url: currentOpticalUrl || submittedCrossModalImages.optical.url,
          label: "OPTICAL / MULTISPECTRAL",
        },
        sar: {
          name: currentSarName,
          url: currentSarUrl || submittedCrossModalImages.sar.url,
          label: "SAR / RADAR",
        },
      };
      const reportInput: ReportInput = {
        mode: "cross_modal",
        query: trimmedQuery,
        finalAnswer: crossModalAnalysis.final_answer,
        opticalImage: crossModalMessageImages.optical,
        sarImage: crossModalMessageImages.sar,
        generatedAt,
      };

      setLatestReport(reportInput);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-cross-modal-${Date.now()}`,
          role: "assistant",
          text: crossModalAnalysis.final_answer,
          query: trimmedQuery,
          generatedAt,
          mode: "cross_modal",
          crossModalImages: crossModalMessageImages,
        },
      ]);
      setQuery("");
    } catch (requestError) {
      setError(friendlyCaughtError(requestError, "Cross-sensor analysis could not be completed."));
    } finally {
      submitLockRef.current = false;
      setIsLoading(false);
    }
  };

  const runChangeAnalysis = useCallback(
    async (changeQuery = "", options: { automatic?: boolean } = {}) => {
      if (!temporalImages.t1 || !temporalImages.t2 || changeSubmitLockRef.current) {
        return;
      }

      const currentPairKey = buildTemporalPairKey(temporalImages.t1, temporalImages.t2);
      changeSubmitLockRef.current = true;
      setIsChangeLoading(true);
      setError("");
      setLatestReport(null);
      setHasWorkspaceOpened(true);

      if (options.automatic) {
        debugLog("[OrbiVue Change] auto compare triggered:", currentPairKey);
      } else {
        debugLog("[OrbiVue Change] follow-up query:", changeQuery);
      }
      debugLog("[OrbiVue Change] endpoint:", CHANGE_ANALYSIS_ENDPOINT);

      if (!options.automatic && changeQuery.trim()) {
        const submittedTemporalImages = {
            t1: {
              name: temporalImages.t1.name,
              url: createMessageImageUrl(temporalImages.t1),
              label: "BEFORE / T1",
              date: temporalImageMetadata.t1?.date,
            },
            t2: {
              name: temporalImages.t2.name,
              url: createMessageImageUrl(temporalImages.t2),
              label: "AFTER / T2",
              date: temporalImageMetadata.t2?.date,
            },
          };

        setMessages((current) => [
          ...current,
          {
            id: `user-change-${Date.now()}`,
            role: "user",
            text: changeQuery.trim(),
            imageName: "T1 / T2 temporal pair",
            temporalImages: submittedTemporalImages,
            temporalImagery: temporalImageMetadata,
          },
        ]);
      }

      try {
        const [imageT1, imageT2] = await Promise.all([
          getCompressedTemporalImage("t1", temporalImages.t1),
          getCompressedTemporalImage("t2", temporalImages.t2),
        ]);
        const formData = new FormData();

        formData.append("image_t1", imageT1, imageT1.name);
        formData.append("image_t2", imageT2, imageT2.name);
        formData.append("query", changeQuery.trim());

        const response = await fetch(CHANGE_ANALYSIS_ENDPOINT, {
          method: "POST",
          body: formData,
        });
        const data = await response.json();

        debugLog("[OrbiVue Change] response received");
        debugLog("[OrbiVue Change] response:", data);

        if (!response.ok) {
          throw new Error(friendlyAnalysisError(response, data, "Change analysis request failed."));
        }

        const changeAnalysis = normalizeChangeAnalysisResponse(data);
        const generatedAt = new Date().toISOString();
        const resultTemporalImages = {
          t1: {
            name: temporalImages.t1?.name ?? "Before image",
            url: createMessageImageUrl(temporalImages.t1),
            label: "BEFORE / T1",
            date: temporalImageMetadata.t1?.date,
          },
          t2: {
            name: temporalImages.t2?.name ?? "After image",
            url: createMessageImageUrl(temporalImages.t2),
            label: "AFTER / T2",
            date: temporalImageMetadata.t2?.date,
          },
        };
        const reportInput: ReportInput = {
          mode: "temporal",
          query: changeQuery.trim() || "Initial temporal change analysis",
          finalAnswer: changeAnalysis.final_answer,
          beforeImage: resultTemporalImages.t1,
          afterImage: resultTemporalImages.t2,
          generatedAt,
          changeAnalysis,
        };

        setLatestReport(reportInput);

        setMessages((current) => [
          ...current,
          {
            id: `assistant-change-${Date.now()}`,
            role: "assistant",
            text: changeAnalysis.final_answer,
            query: reportInput.query,
            generatedAt,
            mode: changeAnalysis.mode,
            temporalImages: resultTemporalImages,
            showTemporalImages: Boolean(options.automatic),
            changeAnalysis,
          },
        ]);
        setQuery("");
      } catch (requestError) {
        analyzedPairRef.current = null;
        setError(friendlyCaughtError(requestError, "Temporal comparison could not be completed. Please try again."));
      } finally {
        changeSubmitLockRef.current = false;
        setIsChangeLoading(false);
      }
    },
    [temporalImageMetadata, temporalImages.t1, temporalImages.t2, temporalPreviewUrls.t1, temporalPreviewUrls.t2]
  );

  useEffect(() => {
    if (
      !isCompareWorkflow ||
      compareMode !== "temporal" ||
      !temporalPairKey ||
      !temporalPreviewUrls.t1 ||
      !temporalPreviewUrls.t2 ||
      isChangeLoading ||
      changeSubmitLockRef.current ||
      analyzedPairRef.current === temporalPairKey
    ) {
      return;
    }

    analyzedPairRef.current = temporalPairKey;
    void runChangeAnalysis("", { automatic: true });
  }, [compareMode, isChangeLoading, isCompareWorkflow, runChangeAnalysis, temporalPairKey, temporalPreviewUrls.t1, temporalPreviewUrls.t2]);

  const retryChangeAnalysis = () => {
    if (!hasTemporalPair || isBusy) {
      return;
    }

    analyzedPairRef.current = null;
    void runChangeAnalysis("", { automatic: true });
  };

  const submitQuery = async () => {
    const trimmedQuery = query.trim();

    if (isCompareWorkflow && compareMode === "cross_modal") {
      await runCrossModalAnalysis(trimmedQuery);
      return;
    }

    if (isCompareWorkflow && compareMode === "temporal" && !hasTemporalPair) {
      setError("Add both BEFORE and AFTER images to compare.");
      return;
    }

    if (isCompareWorkflow && hasTemporalPair) {
      if (!trimmedQuery || isBusy || changeSubmitLockRef.current) {
        return;
      }

      await runChangeAnalysis(trimmedQuery);
      return;
    }

    if (!selectedImage) {
      setError("Upload an image to continue.");
      return;
    }

    if (!trimmedQuery || isBusy || submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;
    setIsLoading(true);
    setError("");
    setLatestReport(null);
    setHasWorkspaceOpened(true);

    const currentImageUrl = imagePreviewUrl;
    const currentImageName = selectedImage.name;
    const submittedImageUrl = createMessageImageUrl(selectedImage);
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmedQuery,
      imageName: currentImageName,
      imageUrl: submittedImageUrl,
      satelliteImagery: selectedImageMetadata ?? undefined,
    };

    setMessages((current) => [...current, userMessage]);

    try {
      debugLog("[OrbiVue] submitting analysis");
      debugLog("[OrbiVue] query:", trimmedQuery);
      debugLog("[OrbiVue] image attached:", Boolean(selectedImage));

      const formData = new FormData();
      let imageForAnalysis =
        compressedImageRef.current?.source === selectedImage ? compressedImageRef.current.file : null;

      if (!imageForAnalysis) {
        imageForAnalysis = await compressImageForAnalysis(selectedImage);
        compressedImageRef.current = {
          source: selectedImage,
          file: imageForAnalysis,
        };
      }

      formData.append("query", trimmedQuery);
      formData.append("image", imageForAnalysis, imageForAnalysis.name);

      const response = await fetch(SINGLE_ANALYSIS_ENDPOINT, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      debugLog("[OrbiVue] response mode:", data?.mode);
      debugLog("[OrbiVue] response:", data);

      if (!response.ok) {
        throw new Error(friendlyAnalysisError(response, data, "Analysis request failed."));
      }

      const finalAnswer =
        typeof data.final_answer === "string"
          ? data.final_answer
          : "Analysis completed. See the highlighted regions in the visual preview.";
      const analysisMode: AnalysisMode = data.mode === "grounding" ? "grounding" : "analysis";
      const boundingBoxes = analysisMode === "grounding" ? normalizeBoundingBoxes(data.bounding_boxes) : [];
      const generatedAt = new Date().toISOString();
      const reportInput: ReportInput = {
        mode: analysisMode === "grounding" ? "grounding" : "analysis",
        query: trimmedQuery,
        finalAnswer,
        boundingBoxes,
        sourceImage: {
          name: currentImageName,
          url: submittedImageUrl || currentImageUrl,
          label: analysisMode === "grounding" ? "Grounding source" : "Source image",
        },
        generatedAt,
      };

      setLatestReport(reportInput);

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: finalAnswer,
          query: trimmedQuery,
          generatedAt,
          imageUrl: submittedImageUrl || currentImageUrl,
          imageName: currentImageName,
          mode: analysisMode,
          boundingBoxes,
          satelliteImagery: selectedImageMetadata ?? undefined,
        },
      ]);
      setQuery("");
      setSelectedImage(null);
      setSelectedImageMetadata(null);
      compressedImageRef.current = null;
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (requestError) {
      setError(friendlyCaughtError(requestError, "ORBIVUE could not reach the analysis service. Please try again."));
    } finally {
      submitLockRef.current = false;
      setIsLoading(false);
    }
  };

  return (
    <main className="main-page orbivue-dashboard" data-theme={theme}>
      <button
        type="button"
        className="orbivue-mobile-menu"
        onClick={() => setIsSidebarOpen(true)}
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      {isSidebarOpen && <button type="button" className="orbivue-sidebar-scrim" onClick={() => setIsSidebarOpen(false)} aria-label="Close navigation" />}

      <OrbivueSidebar
        activeSection={currentNavSection}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNewChat={startNewChat}
        onNavigate={(section) => {
          if (section === "ask") {
            openAskWorkflow();
          }
          if (section === "satellite") {
            openSatelliteExplorer();
          }
          if (section === "intelligence") {
            openCompareWorkflow();
          }
          if (section === "reports") {
            openLatestReportFromHome();
          }
        }}
      />

      <div className="orbivue-command-shell">
        <header className="orbivue-topbar">
          <div>
            <p className="orbivue-kicker">Remote-sensing vision-language platform</p>
            <h1>Ask ORBIVUE</h1>
            <span className="sr-only">Signed in as {userName}</span>
          </div>
          <div className="orbivue-topbar-actions">
            <span className={`orbivue-api-status is-${apiStatus}`}>
              <span aria-hidden="true" />
              {apiStatusLabel(apiStatus)}
            </span>
            <button
              type="button"
              className="orbivue-icon-button"
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              onClick={() => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button type="button" className="orbivue-icon-button" aria-label="Settings">
              <Settings size={18} />
            </button>
          </div>
        </header>

        <div className="orbivue-work-grid">
          <section className="orbivue-primary-column">
            {isSatelliteExplorerOpen ? (
              <SatelliteExplorer
                onClose={() => {
                  setIsSatelliteExplorerOpen(false);
                  setHasWorkspaceOpened(true);
                }}
                onUseSingleImage={useSatelliteSingleImage}
                onUseTemporalImages={useSatelliteTemporalImages}
              />
            ) : (
              <>
                {!isWorkspaceMode && <OrbivueHero />}
                <ChatWorkspace
                  query={query}
                  onQueryChange={updateQuery}
                  onSubmit={submitQuery}
                  isLoading={isBusy}
                  isChangeLoading={isChangeLoading}
                  error={error}
                  selectedImage={selectedImage}
                  selectedImageMetadata={selectedImageMetadata}
                  imagePreviewUrl={imagePreviewUrl}
                  compareMode={compareMode}
                  isCompareWorkflow={isCompareWorkflow}
                  onCompareModeChange={(mode) => {
                    setIsCompareWorkflow(true);
                    setSelectedImage(null);
                    compressedImageRef.current = null;
                    setCompareMode(mode);
                    setError("");
                    setHasWorkspaceOpened(true);
                  }}
                  temporalImages={temporalImages}
                  temporalImageMetadata={temporalImageMetadata}
                  temporalPreviewUrls={temporalPreviewUrls}
                  crossModalImages={crossModalImages}
                  crossModalPreviewUrls={crossModalPreviewUrls}
                  fileInputRef={fileInputRef}
                  onImageSelected={selectImage}
                  onClearImage={clearSelectedImage}
                  onRemoveTemporalImage={removeTemporalImage}
                  onReplaceTemporalImage={replaceTemporalImage}
                  onSwapTemporalImages={swapTemporalImages}
                  onRemoveCrossModalImage={removeCrossModalImage}
                  onReplaceCrossModalImage={replaceCrossModalImage}
                  onRetryChangeAnalysis={retryChangeAnalysis}
                  onOpenReport={setActiveReport}
                  onOpenSatelliteExplorer={openSatelliteExplorer}
                  messages={messages}
                  isWorkspaceMode={isWorkspaceMode}
                />
              </>
            )}
          </section>

          <TrustPanel model={trustPanelModel} />
        </div>
      </div>

      {(activeReport || isReportEmptyStateOpen) && (
        <ReportPreviewModal
          report={activeReport}
          isEmpty={isReportEmptyStateOpen}
          onClose={closeReportPreview}
          onStartAnalysis={returnToAskOrbiVue}
        />
      )}
    </main>
  );
}
