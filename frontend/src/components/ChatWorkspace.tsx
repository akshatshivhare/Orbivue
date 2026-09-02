import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  Check,
  FileText,
  Layers,
  MapPin,
  type LucideIcon,
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

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      onSubmit();
    }
  };

  return (
    <section
      className={`main-query w-full rounded-[1.15rem] border border-[#a9c9ba] bg-[#fbfaf6]/90 shadow-[0_14px_42px_rgba(6,64,51,0.14)] backdrop-blur-md transition-all duration-300 ${
        isWorkspaceMode
          ? `workspace-chat-card ${
              hasActiveWorkspaceContent ? "workspace-chat-card-active" : "workspace-chat-card-empty"
            } flex min-h-0 flex-1 flex-col p-4`
          : "mt-3.5 max-w-[790px] p-3"
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
                  currentTemporalImages={temporalImages}
                  currentTemporalPreviewUrls={temporalPreviewUrls}
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
                  <pre className="whitespace-pre-wrap font-sans">{message.text}</pre>
                </article>
              )
            )}

            {isLoading && (
              <article className="mr-auto max-w-[86%] rounded-xl border border-[#ccd8d3] bg-white/92 px-3.5 py-2.5 text-sm font-semibold text-[#14314b] shadow-sm">
                <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#0b7b5b]/35 border-t-[#0b7b5b]" />
                {isChangeLoading
                  ? "Comparing T1 and T2..."
                  : isCompareWorkflow && compareMode === "cross_modal"
                    ? "Analyzing optical and SAR imagery..."
                    : "OrbiVue is analyzing..."}
              </article>
            )}

            {error && (
              <article className="mr-auto max-w-[86%] rounded-xl border border-[#e7aaa4] bg-[#fff4f1] px-3.5 py-2.5 text-sm font-semibold text-[#9b1c13] shadow-sm">
                <div>{error}</div>
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
          <div className="flex gap-3.5">
            <Sparkles size={21} className="mt-0.5 shrink-0 text-[#1f426a]" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={handleKeyDown}
              className="min-w-0 flex-1 bg-transparent text-[0.94rem] font-medium text-[#173452] outline-none placeholder:text-[#173452]"
              placeholder="Ask anything about changes, 3D, terrain, water, or history..."
            />
            <ComposerIconButtons
              canSubmit={canSubmit}
              fileInputRef={fileInputRef}
              onSubmit={onSubmit}
              isLoading={isLoading}
            />
          </div>
        )}

        <div className={isWorkspaceMode ? "mt-2 shrink-0 rounded-xl border border-[#c2d6cd] bg-[#fffdf8]/88 p-2 shadow-sm" : ""}>
        <div
          className={`flex flex-wrap items-center gap-2 ${
            isWorkspaceMode ? "" : "mt-3 pl-10"
          }`}
        >
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
            <div className="relative flex max-w-[280px] items-center gap-2 rounded-lg border border-[#a9c9ba] bg-[#dcece2] px-2 py-1.5 pr-8 text-[0.8rem] font-semibold text-[#074d3b] shadow-sm">
              {imagePreviewUrl && selectedImage.type.startsWith("image/") ? (
                <img src={imagePreviewUrl} alt="" className="h-11 w-11 shrink-0 rounded-md bg-[#0b222b] object-cover" />
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
          <ComposerAction label="Attach Area" icon={Layers} />
          <ComposerAction label="Date Range" icon={CalendarDays} />
          <ComposerAction label="Data Sources" icon={Layers} />
          {isWorkspaceMode && (
            <div className="ml-auto flex items-center gap-3">
              <ComposerIconButtons
                canSubmit={canSubmit}
                fileInputRef={fileInputRef}
                onSubmit={onSubmit}
                isLoading={isLoading}
              />
            </div>
          )}
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
          <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-[#d5dfda] bg-white/86 px-2.5 py-1.5 shadow-inner">
            <Sparkles size={19} className="shrink-0 text-[#183958]" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={handleKeyDown}
              className="min-w-0 flex-1 bg-transparent text-[0.94rem] font-medium text-[#14314b] outline-none placeholder:text-[#173452]"
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
    <span className="inline-flex max-w-[220px] items-center gap-2 rounded-lg bg-white/14 p-1.5 text-left text-xs font-semibold">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-md bg-[#0b222b] object-cover" />
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
            OrbiVue AI
          </div>
          <div className="mt-1 text-base font-black text-[#0b1d31]">{modeLabel}</div>
        </div>
        <span className="rounded-full bg-[#e8f4eb] px-3 py-1 text-xs font-bold text-[#0b6048]">
          {message.mode === "grounding" ? `${boxes.length} highlighted` : "No boxes"}
        </span>
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
          <div className="mb-2 text-sm font-extrabold text-[#0b1d31]">AI analysis / explanation</div>
          <pre className="whitespace-pre-wrap font-sans text-[0.84rem] leading-5 text-[#14314b]">{message.text}</pre>
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
  currentTemporalImages,
  currentTemporalPreviewUrls,
  onOpenReport,
}: {
  message: ChatMessage;
  currentTemporalImages: TemporalImageState;
  currentTemporalPreviewUrls: TemporalImagePreviews;
  onOpenReport: (report: ReportInput) => void;
}) {
  const analysis = message.changeAnalysis;
  const temporalImages = message.temporalImages;
  const shouldShowImages = message.showTemporalImages !== false;
  const [showVisualCompare, setShowVisualCompare] = useState(false);
  const hasLiveTemporalPair = Boolean(
    currentTemporalImages.t1 &&
      currentTemporalImages.t2 &&
      currentTemporalPreviewUrls.t1 &&
      currentTemporalPreviewUrls.t2
  );

  useEffect(() => {
    if (!hasLiveTemporalPair) {
      setShowVisualCompare(false);
    }
  }, [hasLiveTemporalPair]);

  if (!analysis || !temporalImages) {
    return null;
  }

  const showSummary = analysis.summary && analysis.summary !== analysis.final_answer;

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
          {hasLiveTemporalPair && (
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

      {showVisualCompare && hasLiveTemporalPair && (
        <div className="mb-3">
          <BeforeAfterSlider
            beforeUrl={currentTemporalPreviewUrls.t1}
            afterUrl={currentTemporalPreviewUrls.t2}
            beforeLabel="BEFORE / T1"
            afterLabel="AFTER / T2"
          />
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
        <pre className="mt-2 whitespace-pre-wrap font-sans text-[0.86rem] leading-5 text-[#14314b]">
          {analysis.final_answer}
        </pre>
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
        <pre className="mt-2 whitespace-pre-wrap font-sans text-[0.86rem] leading-5 text-[#14314b]">
          {cleanModelText(message.text)}
        </pre>
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
    <div className="flex flex-wrap items-center gap-2">
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
    <div className="grid gap-2 md:grid-cols-2">
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
    <div className="flex flex-wrap items-center gap-2">
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
    <article className="min-w-0 rounded-xl border border-[#c2d6cd] bg-white/86 p-2 shadow-sm">
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
        <img src={previewUrl} alt={`${label} preview`} className="block h-14 w-full rounded-lg bg-[#0b222b] object-cover" />
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
    <div className="relative flex max-w-[300px] items-center gap-2 rounded-lg border border-[#a9c9ba] bg-[#dcece2] px-2 py-1 pr-8 text-[0.78rem] text-[#074d3b] shadow-sm">
      {previewUrl ? (
        <img src={previewUrl} alt="" className="h-10 w-10 shrink-0 rounded-md bg-[#0b222b] object-cover" />
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
}: {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-[#ccd8d3] bg-white px-2.5 py-1.5 text-[0.78rem] font-bold text-[#183958] shadow-sm transition hover:border-[#0b7b5b] hover:bg-[#e8f4eb]"
    >
      <Icon size={15} />
      {label}
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
        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#ccd8d3] bg-white text-[#0f2338] shadow-sm transition hover:border-[#075f47] hover:text-[#075f47]"
        aria-label="Attach image"
      >
        <Paperclip size={18} />
      </button>
      <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ccd8d3] bg-white text-[#0f2338] shadow-sm">
        <Mic size={18} />
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={isLoading || !canSubmit}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#075f47] text-white shadow-[0_10px_24px_rgba(7,95,71,0.25)] transition hover:bg-[#064836] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/45 border-t-white" />
        ) : (
          <Send size={18} />
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
