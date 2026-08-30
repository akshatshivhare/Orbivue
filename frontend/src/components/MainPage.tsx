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
import { WorkspaceHeader } from "./WorkspaceHeader";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import type {
  AnalysisMode,
  BoundingBox,
  ChangeAnalysisPayload,
  ChangeDirection,
  ChangeItem,
  ChatMessage,
  TemporalImagePreviews,
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

export function MainPage({ userName = "Explorer" }: MainPageProps) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isChangeLoading, setIsChangeLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [temporalImages, setTemporalImages] = useState<TemporalImageState>({ t1: null, t2: null });
  const [temporalPreviewUrls, setTemporalPreviewUrls] = useState<TemporalImagePreviews>({ t1: "", t2: "" });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasWorkspaceOpened, setHasWorkspaceOpened] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const submitLockRef = useRef(false);
  const changeSubmitLockRef = useRef(false);
  const temporalAttachSlotRef = useRef<TemporalImageSlot | "auto">("auto");
  const analyzedPairRef = useRef<string | null>(null);
  const compressedImageRef = useRef<{ source: File; file: File } | null>(null);
  const compressedTemporalImagesRef = useRef<Partial<Record<TemporalImageSlot, { source: File; file: File }>>>({});

  const temporalPairKey = useMemo(
    () => buildTemporalPairKey(temporalImages.t1, temporalImages.t2),
    [temporalImages.t1, temporalImages.t2]
  );
  const hasTemporalPair = Boolean(temporalImages.t1 && temporalImages.t2);
  const isBusy = isLoading || isChangeLoading;
  const isWorkspaceMode =
    hasWorkspaceOpened ||
    query.trim().length > 0 ||
    selectedImage !== null ||
    Boolean(temporalImages.t1 || temporalImages.t2) ||
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

    const requestedSlot = temporalAttachSlotRef.current;
    temporalAttachSlotRef.current = "auto";
    const slot: TemporalImageSlot =
      requestedSlot !== "auto" ? requestedSlot : !temporalImages.t1 ? "t1" : !temporalImages.t2 ? "t2" : "t2";

    const nextTemporalImages =
      slot === "t1"
        ? { t1: file, t2: temporalImages.t2 }
        : { t1: temporalImages.t1 ?? file, t2: temporalImages.t1 ? file : null };

    setTemporalImages(nextTemporalImages);
    setSelectedImage(nextTemporalImages.t1);
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
    setTemporalImages({ t1: null, t2: null });
    setError("");
    compressedImageRef.current = null;
    compressedTemporalImagesRef.current = {};
    analyzedPairRef.current = null;

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeTemporalImage = (slot: TemporalImageSlot) => {
    const nextTemporalImages =
      slot === "t1"
        ? { t1: temporalImages.t2, t2: null }
        : { t1: temporalImages.t1, t2: null };

    setTemporalImages(nextTemporalImages);
    setSelectedImage(nextTemporalImages.t1);
    setError("");
    compressedImageRef.current = null;
    compressedTemporalImagesRef.current = {};
    analyzedPairRef.current = null;

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const replaceTemporalImage = (slot: TemporalImageSlot) => {
    temporalAttachSlotRef.current = slot;
    fileInputRef.current?.click();
  };

  const swapTemporalImages = () => {
    if (!temporalImages.t1 || !temporalImages.t2 || isBusy) {
      return;
    }

    const nextTemporalImages = { t1: temporalImages.t2, t2: temporalImages.t1 };
    setTemporalImages(nextTemporalImages);
    setSelectedImage(nextTemporalImages.t1);
    setError("");
    compressedImageRef.current = null;
    compressedTemporalImagesRef.current = {};
    analyzedPairRef.current = null;
    setHasWorkspaceOpened(true);
    console.log("[OrbiVue Change] temporal pair swapped");
  };

  const startNewChat = () => {
    setMessages([]);
    setQuery("");
    setError("");
    clearSelectedImage();
    setHasWorkspaceOpened(true);
    setIsSidebarOpen(false);
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
        setMessages((current) => [
          ...current,
          {
            id: `user-change-${Date.now()}`,
            role: "user",
            text: changeQuery.trim(),
            imageName: "T1 / T2 temporal pair",
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

        setMessages((current) => [
          ...current,
          {
            id: `assistant-change-${Date.now()}`,
            role: "assistant",
            text: changeAnalysis.final_answer,
            mode: changeAnalysis.mode,
            temporalImages: {
              t1: {
                name: temporalImages.t1?.name ?? "Before image",
                url: temporalPreviewUrls.t1,
                label: "BEFORE / T1",
              },
              t2: {
                name: temporalImages.t2?.name ?? "After image",
                url: temporalPreviewUrls.t2,
                label: "AFTER / T2",
              },
            },
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
    [temporalImages.t1, temporalImages.t2, temporalPreviewUrls.t1, temporalPreviewUrls.t2]
  );

  useEffect(() => {
    if (
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
  }, [isChangeLoading, runChangeAnalysis, temporalPairKey, temporalPreviewUrls.t1, temporalPreviewUrls.t2]);

  const retryChangeAnalysis = () => {
    if (!hasTemporalPair || isBusy) {
      return;
    }

    analyzedPairRef.current = null;
    void runChangeAnalysis("", { automatic: true });
  };

  const submitQuery = async () => {
    const trimmedQuery = query.trim();

    if (hasTemporalPair) {
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
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmedQuery,
      imageName: currentImageName,
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

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: finalAnswer,
          imageUrl: currentImageUrl,
          imageName: currentImageName,
          mode: analysisMode,
          boundingBoxes,
        },
      ]);
      setQuery("");
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
        isWorkspaceMode ? "workspace-mode" : "landing-shell"
      }`}
    >
      <img
        src="/assets/main-earth-bg.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(249,246,239,0.99)_0%,rgba(249,246,239,0.95)_38%,rgba(249,246,239,0.36)_66%,rgba(249,246,239,0.02)_100%)]" />

      <div className="relative z-10 flex h-full min-h-0">
        <WorkspaceSidebar
          isOpen={isSidebarOpen}
          isCollapsed={isSidebarCollapsed}
          onClose={() => setIsSidebarOpen(false)}
          onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
          onNewChat={startNewChat}
          onOpenRecentChat={openRecentChat}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <WorkspaceHeader
            showMenuButton
            onMenuClick={() => setIsSidebarOpen(true)}
            onSidebarToggle={() => setIsSidebarCollapsed((current) => !current)}
          />

          {isWorkspaceMode ? (
            <section className="flex min-h-0 flex-1 px-6 pb-5 pt-1 lg:px-7 lg:pb-6">
              <ChatWorkspace
                query={query}
                onQueryChange={updateQuery}
                onSubmit={submitQuery}
                isLoading={isBusy}
                isChangeLoading={isChangeLoading}
                error={error}
                selectedImage={selectedImage}
                imagePreviewUrl={imagePreviewUrl}
                temporalImages={temporalImages}
                temporalPreviewUrls={temporalPreviewUrls}
                fileInputRef={fileInputRef}
                onImageSelected={selectImage}
                onClearImage={clearSelectedImage}
                onRemoveTemporalImage={removeTemporalImage}
                onReplaceTemporalImage={replaceTemporalImage}
                onSwapTemporalImages={swapTemporalImages}
                onRetryChangeAnalysis={retryChangeAnalysis}
                messages={messages}
                isWorkspaceMode
              />
            </section>
          ) : (
            <section className="main-content relative flex min-h-0 flex-1 flex-col px-6 pb-5 pt-1.5">
              <div className="main-hero max-w-[650px]">
                <div className="inline-flex items-center gap-2 rounded-xl bg-[#e8f4eb] px-3.5 py-1.5 text-[0.82rem] font-semibold text-[#0b6048]">
                  <Sparkles size={15} />
                  Welcome to ORBiVUE
                </div>

                <h1 className="mt-3 text-[2.35rem] font-black leading-[1.04] tracking-normal text-[#10233a]">
                  Ask Earth anything.
                  <br />
                  Understand <span className="text-[#0b7b5b]">change</span>
                  <br />
                  with <span className="text-[#0b7b5b]">intelligence.</span>
                </h1>

                <p className="mt-2.5 max-w-[520px] text-[0.92rem] leading-6 text-[#1f426a]">
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
                imagePreviewUrl={imagePreviewUrl}
                temporalImages={temporalImages}
                temporalPreviewUrls={temporalPreviewUrls}
                fileInputRef={fileInputRef}
                onImageSelected={selectImage}
                onClearImage={clearSelectedImage}
                onRemoveTemporalImage={removeTemporalImage}
                onReplaceTemporalImage={replaceTemporalImage}
                onSwapTemporalImages={swapTemporalImages}
                onRetryChangeAnalysis={retryChangeAnalysis}
                messages={messages}
                isWorkspaceMode={false}
              />

              <div className="main-card-grid mt-4 grid max-w-[840px] grid-cols-4 gap-3.5">
                {actionCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <article
                      key={card.title}
                      className="main-action-card min-h-[128px] rounded-2xl border border-[#d8d8d2] bg-white/86 p-3.5 shadow-sm backdrop-blur-sm"
                    >
                      <span className={`flex h-10 w-10 items-center justify-center rounded-full ${card.color}`}>
                        <Icon size={21} strokeWidth={1.8} />
                      </span>
                      <h2 className="mt-2.5 text-[0.92rem] font-extrabold text-[#141b28]">{card.title}</h2>
                      <p className="mt-1 text-[0.78rem] leading-[1.18rem] text-[#1f426a]">{card.description}</p>
                      <ArrowRight className="mt-1.5 text-[#1f426a]" size={19} />
                    </article>
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
    </main>
  );
}
