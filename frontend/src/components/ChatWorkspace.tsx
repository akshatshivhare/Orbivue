import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Check,
  FileText,
  MapPin,
  type LucideIcon,
  Info,
  Mic,
  Paperclip,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import { GroundingPreview } from "./GroundingPreview";
import type { ReportInput } from "./report/reportUtils";
import type {
  ChangeAnalysisPayload,
  ChangeGuardPayload,
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
  TemporalMessageImage,
} from "./workspaceTypes";

type ChatWorkspaceProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isChangeLoading: boolean;
  error: string;
  selectedImage: File | null;
  selectedImageMetadata: SatelliteImageryMetadata | null;
  imagePreviewUrl: string;
  compareMode: CompareMode;
  isCompareWorkflow: boolean;
  onCompareModeChange: (mode: CompareMode) => void;
  temporalImages: TemporalImageState;
  temporalImageMetadata: TemporalImageryMetadata;
  temporalPreviewUrls: TemporalImagePreviews;
  crossModalImages: CrossModalImageState;
  crossModalPreviewUrls: CrossModalImagePreviews;
  fileInputRef: RefObject<HTMLInputElement>;
  onImageSelected: (file: File | null) => void;
  onClearImage: () => void;
  onRemoveTemporalImage: (slot: TemporalImageSlot) => void;
  onReplaceTemporalImage: (slot: TemporalImageSlot) => void;
  onSwapTemporalImages: () => void;
  onRemoveCrossModalImage: (slot: CrossModalImageSlot) => void;
  onReplaceCrossModalImage: (slot: CrossModalImageSlot) => void;
  onRetryChangeAnalysis: () => void;
  onOpenReport: (report: ReportInput) => void;
  onOpenSatelliteExplorer: () => void;
  messages: ChatMessage[];
  isWorkspaceMode: boolean;
};

export function ChatWorkspace({
  query,
  onQueryChange,
  onSubmit,
  isLoading,
  isChangeLoading,
  error,
  selectedImage,
  selectedImageMetadata,
  imagePreviewUrl,
  compareMode,
  isCompareWorkflow,
  onCompareModeChange,
  temporalImages,
  temporalImageMetadata,
  temporalPreviewUrls,
  crossModalImages,
  crossModalPreviewUrls,
  fileInputRef,
  onImageSelected,
  onClearImage,
  onRemoveTemporalImage,
  onReplaceTemporalImage,
  onSwapTemporalImages,
  onRemoveCrossModalImage,
  onReplaceCrossModalImage,
  onRetryChangeAnalysis,
  onOpenReport,
  onOpenSatelliteExplorer,
  messages,
  isWorkspaceMode,
}: ChatWorkspaceProps) {
  const hasTemporalPair = Boolean(temporalImages.t1 && temporalImages.t2);
  const hasTemporalImage = Boolean(temporalImages.t1 || temporalImages.t2);
  const hasCrossModalPair = Boolean(crossModalImages.optical && crossModalImages.sar);
  const canSubmit = Boolean(selectedImage || (isCompareWorkflow && (hasTemporalPair || hasCrossModalPair)));
  const hasActiveWorkspaceContent = Boolean(messages.length > 0 || error || isLoading || hasTemporalPair || hasCrossModalPair);
  const messageHistoryRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = useRef(messages.length);
  const loadingMode = isChangeLoading
    ? "temporal"
    : isCompareWorkflow && compareMode === "cross_modal"
      ? "cross_modal"
      : inferSingleImageLoadingMode(query);
  const loadingMessage = useLoadingMessage(isLoading, loadingMode);

  useEffect(() => {
    const history = messageHistoryRef.current;
    if (!history) {
      previousMessageCountRef.current = messages.length;
      return;
    }

    const messageCountChanged = previousMessageCountRef.current !== messages.length;
    const distanceFromBottom = history.scrollHeight - history.scrollTop - history.clientHeight;
    const shouldStickToBottom = messageCountChanged || isLoading || distanceFromBottom < 120;

    if (shouldStickToBottom) {
      requestAnimationFrame(() => {
        history.scrollTo({ top: history.scrollHeight, behavior: "smooth" });
      });
    }

    previousMessageCountRef.current = messages.length;
  }, [messages, isLoading, error]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <section
      className={`orbivue-chat-workspace main-query w-full transition-all duration-300 ${
        isWorkspaceMode
          ? `workspace-chat-card ${
              hasActiveWorkspaceContent ? "workspace-chat-card-active" : "workspace-chat-card-empty"
            } flex min-h-0 flex-1 flex-col p-4`
          : "orbivue-ask-card"
      }`}
    >
      <div className={`${isWorkspaceMode ? "flex min-h-0 flex-1 flex-col" : ""}`}>
        {isWorkspaceMode && messages.length === 0 && !isLoading && !error && (
          <div className="mx-auto flex min-h-[260px] w-full max-w-[760px] flex-1 flex-col justify-center px-3 text-center md:min-h-[320px]">
            <Sparkles size={26} className="mx-auto mb-2.5 text-[#123a5d]" />
            <h2 className="text-base font-black text-[#0b1d31] md:text-[1.14rem]">
              Ask anything about changes, 3D, terrain, water, or history...
            </h2>
            <p className="mt-1 text-[0.78rem] text-[#506879]">Your geospatial AI assistant for Earth intelligence.</p>
          </div>
        )}

        {isWorkspaceMode && (messages.length > 0 || error || isLoading) && (
          <div ref={messageHistoryRef} className="chat-history flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto pb-2 pr-2">
            {messages.map((message) =>
              message.role === "assistant" && message.mode === "cross_modal" && message.crossModalImages ? (
                <CrossModalResultCard key={message.id} message={message} onOpenReport={onOpenReport} />
              ) : message.role === "assistant" && message.temporalImages && message.changeAnalysis ? (
                <TemporalResultCard
                  key={message.id}
                  message={message}
                  onOpenReport={onOpenReport}
                />
              ) : message.role === "assistant" && message.imageUrl ? (
                <AssistantResultCard key={message.id} message={message} onOpenReport={onOpenReport} />
              ) : (
                <article
                  key={message.id}
                  className={`max-w-[86%] rounded-xl px-3.5 py-2.5 text-[0.86rem] leading-5 shadow-sm ${
                    message.role === "user"
                      ? "ml-auto bg-[#00624b] text-white"
                      : "mr-auto border border-[#ccd8d3] bg-white/92 text-[#14314b]"
                  }`}
                >
                  <div className="mb-1 text-[0.68rem] font-black uppercase tracking-[0.14em] opacity-70">
                    {message.role === "user" ? "User" : "OrbiVue AI"}
                  </div>
                  {message.role === "user" && <MessageAttachments message={message} />}
                  {message.role === "assistant" ? (
                    <ModelText text={message.text} />
                  ) : (
                    <pre className="whitespace-pre-wrap break-words font-sans">{message.text}</pre>
                  )}
                </article>
              )
            )}

            {isLoading && (
              <article className="mr-auto max-w-[86%] rounded-xl border border-[#ccd8d3] bg-white/92 px-3.5 py-2.5 text-sm font-semibold text-[#14314b] shadow-sm">
                <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#0b7b5b]/35 border-t-[#0b7b5b]" />
                {loadingMessage}
              </article>
            )}

            {error && (
              <article className="mr-auto max-w-[86%] rounded-xl border border-[#e7aaa4] bg-[#fff4f1] px-3.5 py-2.5 text-sm font-semibold text-[#9b1c13] shadow-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
                {compareMode === "temporal" && hasTemporalPair && (
                  <button
                    type="button"
                    onClick={onRetryChangeAnalysis}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#b42318] px-3 py-1.5 text-xs font-black text-white transition hover:bg-[#8f1c13]"
                  >
                    <RefreshCw size={14} />
                    Retry comparison
                  </button>
                )}
              </article>
            )}
          </div>
        )}

        {!isWorkspaceMode && (
          <div className="orbivue-ask-input">
            <div className="orbivue-ask-label">
              <span>Ask ORBIVUE</span>
              <em>English</em>
            </div>
            <textarea
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={4}
              className="orbivue-textarea"
              placeholder="Ask a question after attaching satellite imagery..."
            />
          </div>
        )}

        <div className={isWorkspaceMode ? "orbivue-composer-panel" : "orbivue-composer-panel orbivue-composer-panel-inline"}>
          <div className="orbivue-composer-row">
          {isWorkspaceMode && isCompareWorkflow && (
            <CompareModeToggle compareMode={compareMode} onCompareModeChange={onCompareModeChange} disabled={isLoading} />
          )}
          {isCompareWorkflow && compareMode === "temporal" && hasTemporalImage && (
            <TemporalAttachmentStrip
              temporalImages={temporalImages}
              temporalImageMetadata={temporalImageMetadata}
              onRemoveTemporalImage={onRemoveTemporalImage}
              onReplaceTemporalImage={onReplaceTemporalImage}
              onSwapTemporalImages={onSwapTemporalImages}
              temporalPreviewUrls={temporalPreviewUrls}
              disabled={isLoading}
            />
          )}
          {isCompareWorkflow && compareMode === "cross_modal" && (
            <CrossModalAttachmentStrip
              crossModalImages={crossModalImages}
              onRemoveCrossModalImage={onRemoveCrossModalImage}
              onReplaceCrossModalImage={onReplaceCrossModalImage}
              crossModalPreviewUrls={crossModalPreviewUrls}
              disabled={isLoading}
            />
          )}
          {!isCompareWorkflow && selectedImage && (
            <div className="orbivue-attachment-chip orbivue-selected-image-chip relative flex max-w-[280px] items-center gap-2 rounded-lg border border-[#a9c9ba] bg-[#dcece2] px-2 py-1.5 pr-8 text-[0.8rem] font-semibold text-[#074d3b] shadow-sm">
              {imagePreviewUrl && selectedImage.type.startsWith("image/") ? (
                <img src={imagePreviewUrl} alt="" className="orbivue-attachment-thumb h-11 w-11 shrink-0 rounded-md bg-[#0b222b] object-cover" />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white text-[#074d3b] shadow-inner">
                  <Paperclip size={16} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{selectedImageMetadata?.locationName || selectedImage.name}</span>
                {selectedImageMetadata && (
                  <span className="block truncate text-[0.66rem] font-black uppercase tracking-[0.08em] text-[#657a8c]">
                    {providerShortLabel(selectedImageMetadata.provider, selectedImageMetadata.product)} •{" "}
                    {formatMetadataDate(selectedImageMetadata.date)}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={onClearImage}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#173452] shadow-sm transition hover:bg-[#0b7b5b] hover:text-white"
                aria-label="Remove selected image"
              >
                <X size={14} strokeWidth={2.4} />
              </button>
            </div>
          )}
          <ComposerAction label="Location" icon={MapPin} onClick={onOpenSatelliteExplorer} />
          <div className="orbivue-composer-actions">
            <ComposerIconButtons
              canSubmit={canSubmit}
              fileInputRef={fileInputRef}
              onSubmit={onSubmit}
              isLoading={isLoading}
            />
          </div>
        </div>

        {isCompareWorkflow && compareMode === "temporal" && hasTemporalImage && (
          <div className="mt-2 flex flex-wrap items-center gap-2 pl-1 text-xs font-bold text-[#657a8c]">
            <span
              className={`rounded-full px-3 py-1 ${
                hasTemporalPair ? "bg-[#e8f4eb] text-[#0b6048]" : "bg-[#f3f1ec] text-[#657a8c]"
              }`}
            >
              {hasTemporalPair ? "T1 ↔ T2 Change Mode" : "T1 active"}
            </span>
            {!hasTemporalPair && <span>Add T2 / After image to enable change analysis.</span>}
          </div>
        )}

        {isCompareWorkflow && compareMode === "cross_modal" && isWorkspaceMode && (
          <div className="mt-2">
            <CrossModalUploadPanel
              crossModalImages={crossModalImages}
              crossModalPreviewUrls={crossModalPreviewUrls}
              onRemoveCrossModalImage={onRemoveCrossModalImage}
              onReplaceCrossModalImage={onReplaceCrossModalImage}
              disabled={isLoading}
            />
          </div>
        )}

        {isWorkspaceMode && (
          <div className="orbivue-workspace-composer">
            <Sparkles size={18} className="shrink-0" />
            <textarea
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              className="orbivue-textarea is-compact"
              placeholder={
                isCompareWorkflow && compareMode === "cross_modal"
                  ? "Ask what complementary information the optical and SAR sensors reveal..."
                  : isCompareWorkflow && hasTemporalPair
                  ? "Ask a follow-up about changes between T1 and T2..."
                  : selectedImageMetadata
                  ? "Ask anything about this satellite image..."
                  : "Ask anything about changes, 3D, terrain, water, or history..."
              }
            />
          </div>
        )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.tif,.tiff,.geotiff"
        className="sr-only"
        onChange={(event) => onImageSelected(event.target.files?.[0] ?? null)}
      />
      {imagePreviewUrl && selectedImage && !selectedImage.type.startsWith("image/") && (
        <span className="sr-only">{selectedImage.name}</span>
      )}
      {temporalPreviewUrls.t1 && <span className="sr-only">T1 attached</span>}
      {temporalPreviewUrls.t2 && <span className="sr-only">T2 attached</span>}
      {crossModalPreviewUrls.optical && <span className="sr-only">Optical image attached</span>}
      {crossModalPreviewUrls.sar && <span className="sr-only">SAR image attached</span>}
    </section>
  );
}

function CompareModeToggle({
  compareMode,
  onCompareModeChange,
  disabled,
}: {
  compareMode: CompareMode;
  onCompareModeChange: (mode: CompareMode) => void;
  disabled: boolean;
}) {
  return (
    <div className="inline-flex rounded-xl border border-[#b7d8c8] bg-white/82 p-0.5 shadow-sm" aria-label="Compare mode">
      {(["temporal", "cross_modal"] as CompareMode[]).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onCompareModeChange(mode)}
          disabled={disabled}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
            compareMode === mode ? "bg-[#00624b] text-white shadow-sm" : "text-[#0b6048] hover:bg-[#e8f4eb]"
          }`}
        >
          {mode === "temporal" ? "Change Over Time" : "Optical + SAR"}
        </button>
      ))}
    </div>
  );
}

function MessageAttachments({ message }: { message: ChatMessage }) {
  if (message.crossModalImages) {
    return (
      <div className="mb-2 flex flex-wrap gap-2">
        <MessageThumb imageUrl={message.crossModalImages.optical.url} imageName={message.crossModalImages.optical.name} label="OPTICAL" />
        <MessageThumb imageUrl={message.crossModalImages.sar.url} imageName={message.crossModalImages.sar.name} label="SAR" />
      </div>
    );
  }

  if (message.temporalImages) {
    return (
      <div className="mb-2">
        {message.temporalImagery?.t1 && (
          <div className="mb-1.5 flex items-center gap-1.5 text-[0.72rem] font-bold text-white/82">
            <MapPin size={13} />
            <span>{message.temporalImagery.t1.locationName}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <MessageThumb
            imageUrl={message.temporalImages.t1.url}
            imageName={message.temporalImages.t1.name}
            label={message.temporalImagery?.t1 ? `T1 • ${formatMetadataDate(message.temporalImagery.t1.date)}` : "T1"}
            metadata={message.temporalImagery?.t1 ?? undefined}
          />
          <MessageThumb
            imageUrl={message.temporalImages.t2.url}
            imageName={message.temporalImages.t2.name}
            label={message.temporalImagery?.t2 ? `T2 • ${formatMetadataDate(message.temporalImagery.t2.date)}` : "T2"}
            metadata={message.temporalImagery?.t2 ?? undefined}
          />
        </div>
      </div>
    );
  }

  if (message.imageUrl || message.imageName) {
    return (
      <div className="mb-2">
        {message.satelliteImagery && (
          <div className="mb-1.5 flex items-center gap-1.5 text-[0.72rem] font-bold text-white/82">
            <MapPin size={13} />
            <span>{message.satelliteImagery.locationName}</span>
          </div>
        )}
        <MessageThumb
          imageUrl={message.imageUrl}
          imageName={message.imageName || "Uploaded image"}
          label={message.satelliteImagery ? formatMetadataDate(message.satelliteImagery.date) : "IMAGE"}
          metadata={message.satelliteImagery}
        />
      </div>
    );
  }

  return null;
}

function MessageThumb({
  imageUrl,
  imageName,
  label,
  metadata,
}: {
  imageUrl?: string;
  imageName: string;
  label: string;
  metadata?: SatelliteImageryMetadata;
}) {
  return (
    <span className="orbivue-message-thumb inline-flex max-w-[220px] items-center gap-2 rounded-lg bg-white/14 p-1.5 text-left text-xs font-semibold">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="orbivue-attachment-thumb h-11 w-11 shrink-0 rounded-md bg-[#0b222b] object-cover" />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white/15">
          <Paperclip size={16} />
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[0.62rem] font-black uppercase tracking-[0.12em] opacity-75">{label}</span>
        <span className="block truncate">
          {metadata ? providerShortLabel(metadata.provider, metadata.product) : imageName}
        </span>
      </span>
    </span>
  );
}

type LoadingMode = "analysis" | "grounding" | "temporal" | "cross_modal";

const LOADING_MESSAGES: Record<LoadingMode, string[]> = {
  analysis: ["Preparing satellite AI...", "Loading vision specialist...", "Analyzing imagery..."],
  grounding: ["Preparing visual grounding...", "Locating requested feature...", "Verifying candidate regions..."],
  temporal: ["Preparing temporal analysis...", "Checking image compatibility...", "Comparing imagery..."],
  cross_modal: [
    "Preparing cross-sensor analysis...",
    "Reading optical and SAR inputs...",
    "Comparing sensor evidence...",
  ],
};

function inferSingleImageLoadingMode(query: string): LoadingMode {
  return /\b(where|locate|find|highlight|detect|show|ground)\b/i.test(query) ? "grounding" : "analysis";
}

function useLoadingMessage(isLoading: boolean, mode: LoadingMode) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    setStage(0);

    if (!isLoading) {
      return;
    }

    const timer = window.setInterval(() => {
      setStage((current) => (current + 1) % LOADING_MESSAGES[mode].length);
    }, 1800);

    return () => window.clearInterval(timer);
  }, [isLoading, mode]);

  return LOADING_MESSAGES[mode][stage] ?? LOADING_MESSAGES[mode][0];
}

function ModelText({ text, className = "" }: { text: string; className?: string }) {
  const blocks = cleanModelText(text)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (!blocks.length) {
    return <p className={className}>No response text was returned.</p>;
  }

  return (
    <div className={`orbivue-answer space-y-2 text-[0.86rem] leading-6 text-[#14314b] ${className}`}>
      {blocks.map((block, blockIndex) => {
        const lines = block.split(/\n/).map((line) => line.trim()).filter(Boolean);
        const bulletLines = lines
          .map((line) => line.match(/^[-*•]\s+(.+)$/)?.[1]?.trim())
          .filter((line): line is string => Boolean(line));

        if (bulletLines.length === lines.length && bulletLines.length > 0) {
          return (
            <ul key={`block-${blockIndex}`} className="space-y-1.5">
              {bulletLines.map((line, lineIndex) => (
                <li key={`${blockIndex}-${lineIndex}`} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0b7b5b]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`block-${blockIndex}`} className="whitespace-pre-wrap break-words">
            {block}
          </p>
        );
      })}
    </div>
  );
}

function AssistantResultCard({
  message,
  onOpenReport,
}: {
  message: ChatMessage;
  onOpenReport: (report: ReportInput) => void;
}) {
  const boxes = message.mode === "grounding" ? message.boundingBoxes ?? [] : [];
  const modeLabel = message.mode === "grounding" ? "Visual Grounding" : "Image Analysis";
  const canShowReport = Boolean(message.text && message.imageUrl);

  return (
    <article className="mr-auto w-full rounded-[1rem] border border-[#c2d6cd] bg-white/94 p-3.5 text-[#14314b] shadow-[0_12px_34px_rgba(16,35,58,0.09)]">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#0b6048]">
            ORBIVUE ANALYSIS
          </div>
          <div className="mt-1 text-base font-black text-[#0b1d31]">
            {message.mode === "grounding" ? modeLabel : "Scene Understanding"}
          </div>
        </div>
        {message.mode === "grounding" && (
          <span className="rounded-full bg-[#e8f4eb] px-3 py-1 text-xs font-bold text-[#0b6048]">
            {boxes.length > 0 ? `${boxes.length} localized` : "Localization unavailable"}
          </span>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(220px,39%)_minmax(0,61%)]">
        <div className="min-w-0">
          <GroundingPreview
            imageUrl={message.imageUrl || ""}
            imageName={message.imageName || "Uploaded image"}
            boundingBoxes={boxes}
            className="h-full"
          />
        </div>
        <div className="min-w-0 rounded-xl border border-[#ccd8d3] bg-[#f7f4ed] p-2.5">
          <div className="mb-2 text-sm font-extrabold text-[#0b1d31]">
            {message.mode === "grounding" ? "Localization result" : "Analysis result"}
          </div>
          {message.mode === "grounding" && boxes.length === 0 ? (
            <p className="text-[0.86rem] leading-6 text-[#14314b]">
              No confident localization was produced for this query.
            </p>
          ) : (
            <ModelText text={message.text} />
          )}
        </div>
      </div>

      {canShowReport && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() =>
              onOpenReport({
                mode: message.mode === "grounding" ? "grounding" : "analysis",
                query: message.query,
                finalAnswer: message.text,
                boundingBoxes: boxes,
                sourceImage: {
                  name: message.imageName || "Uploaded image",
                  url: message.imageUrl || "",
                  label: message.mode === "grounding" ? "Grounding source" : "Source image",
                },
                generatedAt: message.generatedAt,
              })
            }
            className="inline-flex items-center gap-2 rounded-lg border border-[#a9c9ba] bg-white px-2.5 py-1.5 text-xs font-black text-[#074d3b] shadow-sm transition hover:bg-[#dcece2]"
            aria-label="Generate OrbiVue analysis report"
          >
            <FileText size={15} />
            Generate Report
          </button>
        </div>
      )}
    </article>
  );
}

function TemporalResultCard({
  message,
  onOpenReport,
}: {
  message: ChatMessage;
  onOpenReport: (report: ReportInput) => void;
}) {
  const analysis = message.changeAnalysis;
  const temporalImages = message.temporalImages;
  const shouldShowImages = message.showTemporalImages !== false;
  const [showVisualCompare, setShowVisualCompare] = useState(false);

  if (!analysis || !temporalImages) {
    return null;
  }

  const showSummary = analysis.summary && analysis.summary !== analysis.final_answer;
  const canCompareSavedImages = Boolean(temporalImages.t1.url && temporalImages.t2.url);
  const guard = analysis.change_guard;

  return (
    <article className="mr-auto w-full rounded-[1rem] border border-[#c2d6cd] bg-white/95 p-3.5 text-[#14314b] shadow-[0_12px_34px_rgba(16,35,58,0.09)]">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#0b6048]">
            OrbiVue AI
          </div>
          <div className="mt-1 text-base font-black text-[#0b1d31]">
            {analysis.mode === "change_vqa" ? "Change Question" : "Temporal Change Analysis"}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-full bg-[#e8f4eb] px-3 py-1 text-xs font-bold text-[#0b6048]">
            {analysis.changes.length} changes
          </span>
          {canCompareSavedImages && (
            <button
              type="button"
              onClick={() => setShowVisualCompare((current) => !current)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#a9c9ba] bg-white px-2.5 py-1.5 text-xs font-black text-[#074d3b] shadow-sm transition hover:bg-[#dcece2]"
              aria-label={showVisualCompare ? "Hide visual before and after comparison" : "Compare before and after images visually"}
            >
              <ArrowLeftRight size={15} />
              Compare Visually
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              onOpenReport({
                mode: "temporal",
                query: message.query,
                finalAnswer: analysis.final_answer,
                beforeImage: temporalImages.t1,
                afterImage: temporalImages.t2,
                generatedAt: message.generatedAt,
                changeAnalysis: analysis,
              })
            }
            className="inline-flex items-center gap-2 rounded-lg border border-[#a9c9ba] bg-white px-2.5 py-1.5 text-xs font-black text-[#074d3b] shadow-sm transition hover:bg-[#dcece2]"
            aria-label="Generate OrbiVue temporal analysis report"
          >
            <FileText size={15} />
            Generate Report
          </button>
        </div>
      </div>

      {guard && <TemporalGuardSummary guard={guard} />}

      {showVisualCompare && canCompareSavedImages && (
        <div className="mb-3">
          <BeforeAfterSlider
            beforeUrl={temporalImages.t1.url}
            afterUrl={temporalImages.t2.url}
            beforeLabel="BEFORE / T1"
            afterLabel="AFTER / T2"
          />
          {guard?.dimension_normalized && <TemporalNormalizationNote />}
        </div>
      )}

      {shouldShowImages && (
        <div className="grid gap-3 md:grid-cols-2">
          <TemporalImagePreview image={temporalImages.t1} />
          <TemporalImagePreview image={temporalImages.t2} />
        </div>
      )}

      <div className="mt-3 rounded-xl border border-[#ccd8d3] bg-[#f7f4ed] p-3">
        <div className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#0b6048]">
          OrbiVue Change Analysis
        </div>
        {showSummary && <p className="mt-2 text-sm leading-6 text-[#173452]">{analysis.summary}</p>}
        <ModelText text={analysis.final_answer} className="mt-2" />
      </div>

      {analysis.changes.length > 0 && (
        <section className="mt-4">
          <h3 className="text-sm font-black text-[#10233a]">Changes</h3>
          <div className="mt-2 grid gap-2.5 md:grid-cols-2">
            {analysis.changes.map((change, index) => (
              <ChangeCard key={`${change.category}-${index}`} change={change} />
            ))}
          </div>
        </section>
      )}

      {analysis.unchanged.length > 0 && (
        <ListSection title="Unchanged" items={analysis.unchanged} />
      )}

      {analysis.limitations.length > 0 && (
        <ListSection title="Limitations" items={analysis.limitations} />
      )}

      {guard && <TemporalGuardDetails guard={guard} />}
    </article>
  );
}

function TemporalImagePreview({ image }: { image: TemporalMessageImage }) {
  return (
    <figure className="min-w-0 rounded-xl border border-[#ccd8d3] bg-[#f7f4ed] p-2.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <figcaption className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#0b6048]">
            {image.label}
          </figcaption>
          <div className="max-w-[260px] truncate text-xs font-semibold text-[#657a8c]">{image.name}</div>
        </div>
        {image.date && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold">{image.date}</span>}
      </div>
      <img src={image.url} alt={`${image.label} preview`} className="block max-h-[230px] w-full rounded-lg object-contain" />
    </figure>
  );
}

function TemporalGuardSummary({ guard }: { guard: ChangeGuardPayload }) {
  const summary = temporalGuardSummary(guard);

  return (
    <section className={`mb-3 rounded-xl border px-3 py-2.5 ${summary.className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-black text-[#10233a]">{summary.label}</div>
          {summary.semanticNote && <p className="mt-1 text-xs font-bold leading-5 opacity-80">{summary.semanticNote}</p>}
        </div>
        <span className="rounded-full bg-white/78 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.1em]">
          Temporal guard
        </span>
      </div>
      {guard.dimension_normalized && <TemporalNormalizationNote className="mt-2" />}
      {guard.alignment_warning && (
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-white/70 px-2.5 py-2 text-xs font-bold leading-5">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{guard.alignment_warning}</span>
        </p>
      )}
    </section>
  );
}

function TemporalNormalizationNote({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-start gap-2 rounded-lg border border-[#c9ddd4] bg-white/78 px-2.5 py-2 text-xs font-bold leading-5 text-[#456172] ${className}`}>
      <Info size={15} className="mt-0.5 shrink-0 text-[#0b6048]" />
      <span>Images were normalized to a common resolution for comparison. This does not establish geospatial registration.</span>
    </p>
  );
}

function TemporalGuardDetails({ guard }: { guard: ChangeGuardPayload }) {
  const rows = [
    ["Mean image difference", formatNullableNumber(guard.mean_absolute_difference)],
    ["Changed pixel fraction", formatPixelFraction(guard.changed_pixel_fraction)],
    ["Exact image match", formatBoolean(guard.exact_match)],
    ["Dimension normalized", formatBoolean(guard.dimension_normalized)],
    ["Comparison resolution", formatSize(guard.comparison_size)],
    ["Qwen called", formatBoolean(guard.qwen_called)],
    ["Semantic interpretation", temporalSemanticLabel(guard.semantic_verification)],
    ["Normalization method", guard.normalization_method || "Not provided"],
    ["Original T1 size", formatSize(guard.original_size_t1)],
    ["Original T2 size", formatSize(guard.original_size_t2)],
    ["Pixel change threshold", formatNullableNumber(guard.pixel_change_threshold)],
    ["Near-identical mean threshold", formatNullableNumber(guard.near_identical_mean_threshold)],
    ["Near-identical fraction threshold", formatPixelFraction(guard.near_identical_fraction_threshold)],
  ].filter(([, value]) => value !== "Not provided");

  if (!rows.length) {
    return null;
  }

  return (
    <details className="mt-3 rounded-xl border border-[#ccd8d3] bg-white/82 p-3 text-[#14314b]">
      <summary className="cursor-pointer text-sm font-black text-[#10233a]">Analysis details</summary>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-[#f7f4ed] px-2.5 py-2">
            <dt className="font-black uppercase tracking-[0.1em] text-[#657a8c]">{label}</dt>
            <dd className="mt-0.5 font-bold text-[#14314b]">{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function temporalGuardSummary(guard: ChangeGuardPayload) {
  const semanticNote = temporalSemanticLabel(guard.semantic_verification);

  switch (guard.status) {
    case "no_measurable_change":
      return {
        label: "No measurable visible change",
        semanticNote,
        className: "border-[#b7d8c8] bg-[#e8f4eb] text-[#0b6048]",
      };
    case "measurable_difference":
      return {
        label: "Visible image-space change detected",
        semanticNote,
        className: "border-[#f1c36d] bg-[#fff7e5] text-[#8a4b00]",
      };
    case "incompatible":
      return {
        label: "Comparison unavailable",
        semanticNote,
        className: "border-[#d8ddd7] bg-[#f1f3f1] text-[#4d5f6d]",
      };
    default:
      return {
        label: "Temporal comparison complete",
        semanticNote,
        className: "border-[#c9ddd4] bg-[#f7f4ed] text-[#456172]",
      };
  }
}

function temporalSemanticLabel(value?: string) {
  switch (value) {
    case "deterministic_no_change":
      return "Verified by deterministic image comparison";
    case "model_generated_unverified":
      return "Semantic interpretation is AI-generated and not independently verified.";
    default:
      return value ? value.replace(/_/g, " ") : "Not provided";
  }
}

function formatNullableNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(5).replace(/0+$/, "").replace(/\.$/, "") : "Not provided";
}

function formatPixelFraction(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Not provided";
  }

  return `${(value * 100).toFixed(value < 0.01 ? 3 : 2)}% of compared pixels`;
}

function formatBoolean(value?: boolean) {
  if (value === true) {
    return "Yes";
  }

  if (value === false) {
    return "No";
  }

  return "Not provided";
}

function formatSize(value?: [number, number] | null) {
  return value ? `${Math.round(value[0])} x ${Math.round(value[1])} px` : "Not provided";
}

function CrossModalResultCard({
  message,
  onOpenReport,
}: {
  message: ChatMessage;
  onOpenReport: (report: ReportInput) => void;
}) {
  const images = message.crossModalImages;

  if (!images) {
    return null;
  }

  return (
    <article className="mr-auto w-full rounded-[1rem] border border-[#c2d6cd] bg-white/95 p-3.5 text-[#14314b] shadow-[0_12px_34px_rgba(16,35,58,0.09)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#0b6048]">
            OrbiVue AI
          </div>
          <div className="mt-1 text-base font-black text-[#0b1d31]">OrbiVue Cross-Modal Analysis</div>
        </div>
        <span className="rounded-full bg-[#e8f4eb] px-3 py-1 text-xs font-bold text-[#0b6048]">
          Optical + SAR
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <SensorImagePreview image={images.optical} />
        <SensorImagePreview image={images.sar} />
      </div>

      <div className="mt-3 rounded-xl border border-[#ccd8d3] bg-[#f7f4ed] p-3">
        <div className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#0b6048]">
          OrbiVue Cross-Modal Analysis
        </div>
        <ModelText text={message.text} className="mt-2" />
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() =>
            onOpenReport({
              mode: "cross_modal",
              query: message.query,
              finalAnswer: cleanModelText(message.text),
              opticalImage: images.optical,
              sarImage: images.sar,
              generatedAt: message.generatedAt,
            })
          }
          className="inline-flex items-center gap-2 rounded-lg border border-[#a9c9ba] bg-white px-2.5 py-1.5 text-xs font-black text-[#074d3b] shadow-sm transition hover:bg-[#dcece2]"
          aria-label="Generate OrbiVue cross-modal analysis report"
        >
          <FileText size={15} />
          Generate Report
        </button>
      </div>
    </article>
  );
}

function SensorImagePreview({ image }: { image: { name: string; url: string; label: string } }) {
  return (
    <figure className="min-w-0 rounded-xl border border-[#ccd8d3] bg-[#f7f4ed] p-2.5">
      <div className="mb-2">
        <figcaption className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#0b6048]">
          {image.label}
        </figcaption>
        <div className="max-w-[320px] truncate text-xs font-semibold text-[#657a8c]">{image.name}</div>
      </div>
      <img
        src={image.url}
        alt={`${image.label} preview`}
        className="block max-h-[210px] w-full rounded-lg bg-[#0b222b] object-contain"
      />
    </figure>
  );
}

function ChangeCard({ change }: { change: ChangeAnalysisPayload["changes"][number] }) {
  return (
    <article className="rounded-xl border border-[#ccd8d3] bg-white/88 p-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-black text-[#10233a]">{change.category}</h4>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.1em] text-[#0b6048]">
            {directionMarker(change.direction)} {change.direction}
          </p>
        </div>
        {typeof change.confidence === "number" && (
          <span className="shrink-0 rounded-full bg-[#e8f4eb] px-2.5 py-1 text-xs font-black text-[#0b6048]">
            {formatConfidence(change.confidence)}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[0.84rem] leading-5 text-[#14314b]">{change.description}</p>
    </article>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mt-3 rounded-xl border border-[#ccd8d3] bg-white/78 p-3.5">
      <h3 className="text-sm font-black text-[#10233a]">{title}</h3>
      <ul className="mt-2 space-y-1.5 text-[0.84rem] leading-5 text-[#14314b]">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0b7b5b]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TemporalAttachmentStrip({
  temporalImages,
  temporalImageMetadata,
  temporalPreviewUrls,
  onRemoveTemporalImage,
  onReplaceTemporalImage,
  onSwapTemporalImages,
  disabled,
}: {
  temporalImages: TemporalImageState;
  temporalImageMetadata: TemporalImageryMetadata;
  temporalPreviewUrls: TemporalImagePreviews;
  onRemoveTemporalImage: (slot: TemporalImageSlot) => void;
  onReplaceTemporalImage: (slot: TemporalImageSlot) => void;
  onSwapTemporalImages: () => void;
  disabled: boolean;
}) {
  const hasPair = Boolean(temporalImages.t1 && temporalImages.t2);

  return (
    <div className="orbivue-attachment-strip flex flex-wrap items-center gap-2">
      {temporalImages.t1 && (
        <TemporalChip
          label="T1 / BEFORE"
          fileName={temporalImageMetadata.t1 ? satelliteChipLabel(temporalImageMetadata.t1) : temporalImages.t1.name}
          previewUrl={temporalPreviewUrls.t1}
          onRemove={() => onRemoveTemporalImage("t1")}
          onReplace={() => onReplaceTemporalImage("t1")}
          disabled={disabled}
        />
      )}
      {hasPair && (
        <button
          type="button"
          onClick={onSwapTemporalImages}
          disabled={disabled}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#a9c9ba] bg-white px-2.5 text-xs font-black text-[#074d3b] shadow-sm transition hover:bg-[#dcece2] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowLeftRight size={15} />
          Swap
        </button>
      )}
      {temporalImages.t2 ? (
        <TemporalChip
          label="T2 / AFTER"
          fileName={temporalImageMetadata.t2 ? satelliteChipLabel(temporalImageMetadata.t2) : temporalImages.t2.name}
          previewUrl={temporalPreviewUrls.t2}
          onRemove={() => onRemoveTemporalImage("t2")}
          onReplace={() => onReplaceTemporalImage("t2")}
          disabled={disabled}
        />
      ) : (
        <button
          type="button"
          onClick={() => onReplaceTemporalImage("t2")}
          disabled={disabled || !temporalImages.t1}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-dashed border-[#a9c9ba] bg-white/80 px-2.5 text-[0.8rem] font-black text-[#074d3b] shadow-sm transition hover:bg-[#dcece2] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Paperclip size={16} />
          Add T2 / After image
        </button>
      )}
    </div>
  );
}

function CrossModalUploadPanel({
  crossModalImages,
  crossModalPreviewUrls,
  onRemoveCrossModalImage,
  onReplaceCrossModalImage,
  disabled,
}: {
  crossModalImages: CrossModalImageState;
  crossModalPreviewUrls: CrossModalImagePreviews;
  onRemoveCrossModalImage: (slot: CrossModalImageSlot) => void;
  onReplaceCrossModalImage: (slot: CrossModalImageSlot) => void;
  disabled: boolean;
}) {
  return (
    <div className="orbivue-cross-modal-upload-grid grid gap-2 md:grid-cols-2">
      <CrossModalUploadCard
        slot="optical"
        label="OPTICAL / MULTISPECTRAL"
        helper="Upload optical imagery"
        file={crossModalImages.optical}
        previewUrl={crossModalPreviewUrls.optical}
        onRemove={() => onRemoveCrossModalImage("optical")}
        onReplace={() => onReplaceCrossModalImage("optical")}
        disabled={disabled}
      />
      <CrossModalUploadCard
        slot="sar"
        label="SAR / RADAR"
        helper="Upload SAR imagery"
        file={crossModalImages.sar}
        previewUrl={crossModalPreviewUrls.sar}
        onRemove={() => onRemoveCrossModalImage("sar")}
        onReplace={() => onReplaceCrossModalImage("sar")}
        disabled={disabled}
      />
    </div>
  );
}

function CrossModalAttachmentStrip({
  crossModalImages,
  crossModalPreviewUrls,
  onRemoveCrossModalImage,
  onReplaceCrossModalImage,
  disabled,
}: {
  crossModalImages: CrossModalImageState;
  crossModalPreviewUrls: CrossModalImagePreviews;
  onRemoveCrossModalImage: (slot: CrossModalImageSlot) => void;
  onReplaceCrossModalImage: (slot: CrossModalImageSlot) => void;
  disabled: boolean;
}) {
  return (
    <div className="orbivue-attachment-strip flex flex-wrap items-center gap-2">
      {crossModalImages.optical ? (
        <TemporalChip
          label="OPTICAL / MULTISPECTRAL"
          fileName={crossModalImages.optical.name}
          previewUrl={crossModalPreviewUrls.optical}
          onRemove={() => onRemoveCrossModalImage("optical")}
          onReplace={() => onReplaceCrossModalImage("optical")}
          disabled={disabled}
        />
      ) : (
        <CompactUploadButton label="Add Optical" onClick={() => onReplaceCrossModalImage("optical")} disabled={disabled} />
      )}
      {crossModalImages.sar ? (
        <TemporalChip
          label="SAR / RADAR"
          fileName={crossModalImages.sar.name}
          previewUrl={crossModalPreviewUrls.sar}
          onRemove={() => onRemoveCrossModalImage("sar")}
          onReplace={() => onReplaceCrossModalImage("sar")}
          disabled={disabled}
        />
      ) : (
        <CompactUploadButton label="Add SAR" onClick={() => onReplaceCrossModalImage("sar")} disabled={disabled} />
      )}
    </div>
  );
}

function CompactUploadButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-dashed border-[#a9c9ba] bg-white/80 px-2.5 text-[0.8rem] font-black text-[#074d3b] shadow-sm transition hover:bg-[#dcece2] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Paperclip size={16} />
      {label}
    </button>
  );
}

function CrossModalUploadCard({
  label,
  helper,
  file,
  previewUrl,
  onRemove,
  onReplace,
  disabled,
}: {
  slot: CrossModalImageSlot;
  label: string;
  helper: string;
  file: File | null;
  previewUrl: string;
  onRemove: () => void;
  onReplace: () => void;
  disabled: boolean;
}) {
  return (
    <article className="orbivue-cross-modal-upload-card min-w-0 rounded-xl border border-[#c2d6cd] bg-white/86 p-2 shadow-sm">
      <div className="mb-1.5 flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h3 className="text-[0.72rem] font-black uppercase tracking-[0.14em] text-[#0b6048]">{label}</h3>
          <p className="mt-0.5 text-xs font-semibold text-[#657a8c]">{helper}</p>
        </div>
        {file && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e8f4eb] text-[#0b6048]">
            <Check size={16} />
          </span>
        )}
      </div>

      {previewUrl ? (
        <img src={previewUrl} alt={`${label} preview`} className="orbivue-cross-modal-preview block h-20 w-full rounded-lg bg-[#0b222b] object-contain" />
      ) : (
        <button
          type="button"
          onClick={onReplace}
          disabled={disabled}
          className="flex h-14 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#a9c9ba] bg-[#f7f4ed] text-xs font-black text-[#074d3b] transition hover:bg-[#dcece2] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Paperclip size={17} />
          Upload
        </button>
      )}

      {file && (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs font-semibold text-[#657a8c]">{file.name}</span>
          <span className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onReplace}
              disabled={disabled}
            className="rounded-lg bg-[#dcece2] px-2.5 py-1.5 text-xs font-black text-[#074d3b] transition hover:bg-[#cde2d5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-black text-[#173452] shadow-sm transition hover:bg-[#0b7b5b] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Remove
            </button>
          </span>
        </div>
      )}
    </article>
  );
}

function TemporalChip({
  label,
  fileName,
  previewUrl,
  onRemove,
  onReplace,
  disabled,
}: {
  label: string;
  fileName: string;
  previewUrl?: string;
  onRemove: () => void;
  onReplace: () => void;
  disabled: boolean;
}) {
  return (
    <div className="orbivue-attachment-chip orbivue-temporal-chip relative flex max-w-[300px] items-center gap-2 rounded-lg border border-[#a9c9ba] bg-[#dcece2] px-2 py-1 pr-8 text-[0.78rem] text-[#074d3b] shadow-sm">
      {previewUrl ? (
        <img src={previewUrl} alt="" className="orbivue-attachment-thumb h-10 w-10 shrink-0 rounded-md bg-[#0b222b] object-cover" />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-[#074d3b] shadow-inner">
          <Paperclip size={16} />
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-[0.65rem] font-black uppercase tracking-[0.12em]">{label}</span>
        <span className="block truncate font-semibold">{fileName}</span>
      </span>
      <button
        type="button"
        onClick={onReplace}
        disabled={disabled}
        className="rounded-md bg-white px-2 py-1 text-xs font-black text-[#173452] shadow-sm transition hover:bg-[#0b7b5b] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        Replace
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#173452] shadow-sm transition hover:bg-[#0b7b5b] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={`Remove ${label}`}
      >
        <X size={14} strokeWidth={2.4} />
      </button>
    </div>
  );
}

function ComposerAction({
  label,
  icon: Icon,
  onClick,
  comingSoon = false,
}: {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  comingSoon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={comingSoon}
      title={comingSoon ? `${label} coming soon` : undefined}
      className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[0.78rem] font-bold shadow-sm transition ${
        comingSoon
          ? "cursor-not-allowed border-[#d8ddd7] bg-[#f3f1ec] text-[#7b8a94] opacity-75"
          : "border-[#ccd8d3] bg-white text-[#183958] hover:border-[#0b7b5b] hover:bg-[#e8f4eb]"
      }`}
    >
      <Icon size={15} />
      {label}
      {comingSoon && <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.08em]">Soon</span>}
    </button>
  );
}

function ComposerIconButtons({
  canSubmit,
  fileInputRef,
  onSubmit,
  isLoading,
}: {
  canSubmit: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="orbivue-control-button"
        aria-label="Attach image"
      >
        <Paperclip size={16} />
        Attach
      </button>
      <button
        type="button"
        disabled
        title="Voice coming soon"
        className="orbivue-control-button is-disabled"
        aria-label="Voice input coming soon"
      >
        <Mic size={16} />
        Mic
        <span>Coming Soon</span>
      </button>
      <button
        type="button"
        disabled
        title="More languages coming soon"
        className="orbivue-control-button is-disabled"
        aria-label="Language selector"
      >
        English
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={isLoading || !canSubmit}
        className="orbivue-control-button is-primary"
      >
        {isLoading ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/45 border-t-white" />
        ) : (
          <>
            <Send size={16} />
            Send
          </>
        )}
      </button>
    </>
  );
}

function directionMarker(direction: string) {
  switch (direction) {
    case "increased":
    case "appeared":
      return "↑";
    case "decreased":
    case "disappeared":
      return "↓";
    case "unchanged":
      return "•";
    case "modified":
      return "↔";
    default:
      return "?";
  }
}

function formatConfidence(confidence: number) {
  const normalized = confidence <= 1 ? confidence * 100 : confidence;
  return `${Math.round(Math.max(0, Math.min(100, normalized)))}%`;
}

function cleanModelText(text: string) {
  return text.replace(/\\n/g, "\n").replace(/\*\*/g, "").trim();
}

function providerShortLabel(provider: string, product?: string) {
  if (provider === "sentinel-2") {
    return `Sentinel-2${product ? ` ${product}` : ""}`;
  }

  if (provider === "nasa-viirs") {
    return "NASA VIIRS";
  }

  return product ? `${provider} ${product}` : provider;
}

function formatMetadataDate(value?: string) {
  if (!value) {
    return "Satellite image";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function satelliteChipLabel(metadata: SatelliteImageryMetadata) {
  return `${metadata.locationName} • ${providerShortLabel(metadata.provider, metadata.product)} • ${formatMetadataDate(metadata.date)}`;
}
