import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Box,
  Clock3,
  ShieldCheck,
  Sparkles,
  Trees,
} from "lucide-react";
import { apiUrl } from "../config/api";
import { ChatWorkspace } from "./ChatWorkspace";
import { ReportPreviewModal } from "./report/ReportPreviewModal";
import type { ReportInput } from "./report/reportUtils";
import { SatelliteExplorer } from "./SatelliteExplorer";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import type {
  AnalysisMode,
  BoundingBox,
  ChangeAnalysisPayload,
  ChangeDirection,
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

const actionCards = [
  {
    title: "Analyze Changes",
    description: "Detect land, water, vegetation and temperature changes.",
    icon: Trees,
    color: "bg-[#08714f] text-white",
  },
  {
    title: "3D & Terrain",
    description: "Explore terrain, elevation and 3D reconstruction.",
    icon: Box,
    color: "bg-[#3b93d1] text-white",
  },
  {
    title: "Compare Over Time",
    description: "See how places change across any time period.",
    icon: Clock3,
    color: "bg-[#f2a236] text-white",
  },
  {
    title: "Generate Reports",
    description: "Create AI-generated reports and visual insights.",
    icon: BarChart3,
    color: "bg-[#7b5aa6] text-white",
  },
];

const MAX_ANALYSIS_IMAGE_SIDE = 1280;
const ANALYSIS_IMAGE_QUALITY = 0.86;
const SINGLE_ANALYSIS_ENDPOINT = apiUrl("/api/analyze");
const CHANGE_ANALYSIS_ENDPOINT = apiUrl("/api/change-analyze");
const CROSS_MODAL_ENDPOINT = apiUrl("/api/cross-modal");

type MainPageProps = {
  userName?: string;
};

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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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
  const hasTemporalPair = Boolean(temporalImages.t1 && temporalImages.t2);
  const hasCrossModalPair = Boolean(crossModalImages.optical && crossModalImages.sar);
  const isBusy = isLoading || isChangeLoading;
  const isWorkspaceMode =
    hasWorkspaceOpened ||
    query.trim().length > 0 ||
    selectedImage !== null ||
    (isCompareWorkflow && Boolean(temporalImages.t1 || temporalImages.t2)) ||
    (isCompareWorkflow && Boolean(crossModalImages.optical || crossModalImages.sar)) ||
    messages.length > 0;

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
      setHasWorkspaceOpened(true);
      compressedCrossModalImagesRef.current[slot] = undefined;

      console.log(`[OrbiVue CrossModal] ${slot === "optical" ? "Optical" : "SAR"} attached:`, file.name);
      console.log("[OrbiVue CrossModal] pair ready:", Boolean(nextCrossModalImages.optical && nextCrossModalImages.sar));

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return;
    }

    if (!isCompareWorkflow) {
      setSelectedImage(file);
      setSelectedImageMetadata(null);
      setError("");
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
    compressedImageRef.current = null;
    compressedTemporalImagesRef.current[slot] = undefined;
    analyzedPairRef.current = null;

    console.log(`[OrbiVue Change] ${slot === "t1" ? "T1 attached" : "T2 attached"}:`, file.name);
    console.log("[OrbiVue Change] temporal mode active:", Boolean(nextTemporalImages.t1 && nextTemporalImages.t2));

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
    compressedImageRef.current = null;

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const clearCrossModalImages = () => {
    setCrossModalImages({ optical: null, sar: null });
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
    compressedImageRef.current = null;
    fileInputRef.current?.click();
  };

  const replaceCrossModalImage = (slot: CrossModalImageSlot) => {
    crossModalAttachSlotRef.current = slot;
    setCompareMode("cross_modal");
    setIsCompareWorkflow(true);
    setSelectedImage(null);
    setSelectedImageMetadata(null);
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
    compressedImageRef.current = null;
    compressedTemporalImagesRef.current = {};
    analyzedPairRef.current = null;
    setHasWorkspaceOpened(true);
    console.log("[OrbiVue Change] temporal pair swapped");
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
      alert("Please attach an optical image first!");
      return;
    }

    if (!crossModalImages.sar) {
      alert("Please attach a SAR image first!");
      return;
    }

    if (!trimmedQuery) {
      return;
    }

    submitLockRef.current = true;
    setIsLoading(true);
    setError("");
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
      console.log("[OrbiVue CrossModal] submitting analysis");
      console.log("[OrbiVue CrossModal] endpoint:", CROSS_MODAL_ENDPOINT);

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

      console.log("[OrbiVue CrossModal] response:", data);

      if (!response.ok) {
        throw new Error(data.detail || data.final_answer || "Cross-modal analysis request failed.");
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
      setError(
        requestError instanceof Error
          ? `Cross-modal analysis could not be completed. ${requestError.message}`
          : "Cross-modal analysis could not be completed."
      );
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
      setHasWorkspaceOpened(true);

      if (options.automatic) {
        console.log("[OrbiVue Change] auto compare triggered:", currentPairKey);
      } else {
        console.log("[OrbiVue Change] follow-up query:", changeQuery);
      }
      console.log("[OrbiVue Change] endpoint:", CHANGE_ANALYSIS_ENDPOINT);

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

        console.log("[OrbiVue Change] response received");
        console.log("[OrbiVue Change] response:", data);

        if (!response.ok) {
          throw new Error(data.detail || data.final_answer || "Change analysis request failed.");
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
        setError(
          requestError instanceof Error
            ? `Change analysis could not be completed. ${requestError.message}`
            : "Change analysis could not be completed."
        );
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

    if (isCompareWorkflow && hasTemporalPair) {
      if (!trimmedQuery || isBusy || changeSubmitLockRef.current) {
        return;
      }

      await runChangeAnalysis(trimmedQuery);
      return;
    }

    if (!selectedImage) {
      alert("Please attach an image first!");
      return;
    }

    if (!trimmedQuery || isBusy || submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;
    setIsLoading(true);
    setError("");
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
      console.log("[OrbiVue] submitting analysis");
      console.log("[OrbiVue] query:", trimmedQuery);
      console.log("[OrbiVue] image attached:", Boolean(selectedImage));

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

      console.log("[OrbiVue] response mode:", data?.mode);
      console.log("[OrbiVue] response:", data);

      if (!response.ok) {
        throw new Error(data.detail || "Analysis request failed.");
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
      setError(requestError instanceof Error ? requestError.message : "Unable to reach analysis backend.");
    } finally {
      submitLockRef.current = false;
      setIsLoading(false);
    }
  };

  return (
    <main
      className={`main-page fixed inset-0 overflow-hidden bg-[#061b22] text-[#10233a] ${
        isWorkspaceMode || isSatelliteExplorerOpen ? "workspace-mode" : "landing-shell"
      }`}
    >
      <img
        src="/assets/orbivue-space-earth-bg.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,18,26,0.38)_0%,rgba(4,18,26,0.18)_38%,rgba(4,18,26,0.05)_100%)]" />

      <div className="relative z-10 flex h-full min-h-0">
        <WorkspaceSidebar
          isOpen={isSidebarOpen}
          isCollapsed={isSidebarCollapsed}
          onClose={() => setIsSidebarOpen(false)}
          onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
          onNewChat={startNewChat}
          onOpenAsk={openAskWorkflow}
          onOpenCompare={openCompareWorkflow}
          onOpenRecentChat={openRecentChat}
          activeSection={isCompareWorkflow ? "compare" : "ask"}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <WorkspaceHeader
            showMenuButton
            onMenuClick={() => setIsSidebarOpen(true)}
            onSidebarToggle={() => setIsSidebarCollapsed((current) => !current)}
          />

          {isSatelliteExplorerOpen ? (
            <section className="workspace-stage flex min-h-0 flex-1 items-center justify-center px-4 py-3 lg:px-6">
              <SatelliteExplorer
                onClose={() => {
                  setIsSatelliteExplorerOpen(false);
                  setHasWorkspaceOpened(true);
                }}
                onUseSingleImage={useSatelliteSingleImage}
                onUseTemporalImages={useSatelliteTemporalImages}
              />
            </section>
          ) : isWorkspaceMode ? (
            <section className="workspace-stage flex min-h-0 flex-1 items-center justify-center px-4 py-3 lg:px-6">
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
                isWorkspaceMode
              />
            </section>
          ) : (
            <section className="main-content relative flex min-h-0 flex-1 flex-col px-5 pb-4 pt-1.5">
              <div className="main-hero max-w-[600px]">
                <div className="inline-flex items-center gap-2 rounded-lg bg-[#dcece2] px-3 py-1.5 text-[0.78rem] font-bold text-[#074d3b]">
                  <Sparkles size={15} />
                  Welcome to ORBiVUE
                </div>

                <h1 className="mt-2.5 text-[2.18rem] font-black leading-[1.03] tracking-normal text-white">
                  Ask Earth anything.
                  <br />
                  Understand <span className="text-[#0b7b5b]">change</span>
                  <br />
                  with <span className="text-[#0b7b5b]">intelligence.</span>
                </h1>

                <p className="mt-2 max-w-[500px] text-[0.86rem] leading-5 text-white/84">
                  OrbiVue combines multi-sensor data, AI models, and historical comparison to help you analyze
                  changes, monitor the environment, and make confident decisions instantly.
                </p>
                <span className="sr-only">Signed in as {userName}</span>
              </div>

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
                isWorkspaceMode={false}
              />

              <div className="main-card-grid mt-3.5 grid max-w-[790px] grid-cols-4 gap-3">
                {actionCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      type="button"
                      key={card.title}
                      onClick={
                        card.title === "Generate Reports"
                          ? openLatestReportFromHome
                          : card.title === "Compare Over Time"
                            ? () => {
                                setIsCompareWorkflow(true);
                                setSelectedImage(null);
                                compressedImageRef.current = null;
                                setCompareMode("temporal");
                                setHasWorkspaceOpened(true);
                              }
                            : undefined
                      }
                      className="main-action-card min-h-[112px] rounded-xl border border-[#cbcfc8] bg-white/86 p-3 text-left shadow-sm backdrop-blur-sm transition hover:border-[#9bbfae] hover:bg-white/95"
                    >
                      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${card.color}`}>
                        <Icon size={19} strokeWidth={1.8} />
                      </span>
                      <h2 className="mt-2 text-[0.86rem] font-extrabold text-[#111827]">{card.title}</h2>
                      <p className="mt-1 text-[0.72rem] leading-[1.08rem] text-[#183958]">{card.description}</p>
                      <ArrowRight className="mt-1 text-[#183958]" size={17} />
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <footer className="main-footer relative z-10 grid h-[3.4rem] grid-cols-3 items-center bg-[#005742] px-8 text-sm text-white/85">
            <div className="flex items-center gap-3">
              <span>Data Sources</span>
              <span className="h-2.5 w-2.5 rounded-full bg-[#37c861]" />
              <span>Live</span>
            </div>
            <div className="text-center">Last updated: May 15, 2026, 10:31 AM IST</div>
            <div className="flex items-center justify-end gap-9">
              <span>Privacy</span>
              <span>Terms</span>
              <span>Feedback</span>
              <span className="flex items-center gap-3">
                <ShieldCheck size={22} />
                All systems normal
              </span>
            </div>
          </footer>
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
