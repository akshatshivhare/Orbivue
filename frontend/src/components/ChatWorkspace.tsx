import { useEffect, useState, type KeyboardEvent, type RefObject } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  FileText,
  Layers,
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
  TemporalImagePreviews,
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
  imagePreviewUrl: string;
  temporalImages: TemporalImageState;
  temporalPreviewUrls: TemporalImagePreviews;
  fileInputRef: RefObject<HTMLInputElement>;
  onImageSelected: (file: File | null) => void;
  onClearImage: () => void;
  onRemoveTemporalImage: (slot: TemporalImageSlot) => void;
  onReplaceTemporalImage: (slot: TemporalImageSlot) => void;
  onSwapTemporalImages: () => void;
  onRetryChangeAnalysis: () => void;
  onOpenReport: (report: ReportInput) => void;
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
  imagePreviewUrl,
  temporalImages,
  temporalPreviewUrls,
  fileInputRef,
  onImageSelected,
  onClearImage,
  onRemoveTemporalImage,
  onReplaceTemporalImage,
  onSwapTemporalImages,
  onRetryChangeAnalysis,
  onOpenReport,
  messages,
  isWorkspaceMode,
}: ChatWorkspaceProps) {
  const hasTemporalPair = Boolean(temporalImages.t1 && temporalImages.t2);
  const hasTemporalImage = Boolean(temporalImages.t1 || temporalImages.t2);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      onSubmit();
    }
  };

  return (
    <section
      className={`main-query w-full rounded-[1.35rem] border border-[#b7d8c8] bg-white/88 shadow-[0_18px_55px_rgba(11,96,72,0.16)] backdrop-blur-md transition-all duration-300 ${
        isWorkspaceMode
          ? "flex min-h-[calc(100svh-12rem)] max-w-[1120px] flex-1 flex-col p-7 xl:max-w-[1180px]"
          : "mt-4 max-w-[840px] p-3.5"
      }`}
    >
      <div className={`${isWorkspaceMode ? "flex min-h-0 flex-1 flex-col" : ""}`}>
        {isWorkspaceMode && messages.length === 0 && !isLoading && !error && (
          <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
            <Sparkles size={38} className="mb-5 text-[#163e65]" />
            <h2 className="text-2xl font-black text-[#10233a] md:text-[1.65rem]">
              Ask anything about changes, 3D, terrain, water, or history...
            </h2>
            <p className="mt-3 text-base text-[#657a8c]">Your geospatial AI assistant for Earth intelligence.</p>
          </div>
        )}

        {isWorkspaceMode && (messages.length > 0 || error || isLoading) && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
            {messages.map((message) =>
              message.role === "assistant" && message.temporalImages && message.changeAnalysis ? (
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
                  className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                    message.role === "user"
                      ? "ml-auto bg-[#00624b] text-white"
                      : "mr-auto border border-[#d8e1dc] bg-white/92 text-[#173452]"
                  }`}
                >
                  <div className="mb-1 text-[0.68rem] font-black uppercase tracking-[0.14em] opacity-70">
                    {message.role === "user" ? "User" : "OrbiVue AI"}
                  </div>
                  {message.imageName && message.role === "user" && (
                    <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-lg bg-white/14 px-2.5 py-1 text-xs font-semibold">
                      <Paperclip size={14} />
                      <span className="truncate">{message.imageName}</span>
                    </div>
                  )}
                  <pre className="whitespace-pre-wrap font-sans">{message.text}</pre>
                </article>
              )
            )}

            {isLoading && (
              <article className="mr-auto max-w-[86%] rounded-2xl border border-[#d8e1dc] bg-white/92 px-4 py-3 text-sm font-semibold text-[#173452] shadow-sm">
                <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#0b7b5b]/35 border-t-[#0b7b5b]" />
                {isChangeLoading ? "Comparing T1 and T2..." : "OrbiVue is analyzing..."}
              </article>
            )}

            {error && (
              <article className="mr-auto max-w-[86%] rounded-2xl border border-[#f4c7c2] bg-[#fff6f4] px-4 py-3 text-sm font-semibold text-[#b42318] shadow-sm">
                <div>{error}</div>
                {hasTemporalPair && (
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
              canSubmit={Boolean(selectedImage || hasTemporalPair)}
              fileInputRef={fileInputRef}
              onSubmit={onSubmit}
              isLoading={isLoading}
            />
          </div>
        )}

        <div
          className={`flex flex-wrap items-center gap-3 ${
            isWorkspaceMode ? "mt-auto border-t border-[#d8e1dc] pt-5" : "mt-3.5 pl-10"
          }`}
        >
          {hasTemporalImage && (
            <TemporalAttachmentStrip
              temporalImages={temporalImages}
              onRemoveTemporalImage={onRemoveTemporalImage}
              onReplaceTemporalImage={onReplaceTemporalImage}
              onSwapTemporalImages={onSwapTemporalImages}
              disabled={isLoading}
            />
          )}
          {!hasTemporalImage && selectedImage && (
            <div className="relative flex max-w-[360px] items-center gap-3 rounded-xl border border-[#b7d8c8] bg-[#e8f4eb] px-3 py-2.5 pr-10 text-sm font-semibold text-[#0b6048] shadow-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#0b6048] shadow-inner">
                <Paperclip size={18} />
              </span>
              <span className="min-w-0 flex-1 truncate">{selectedImage.name}</span>
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
          <ComposerAction label="Attach Area" icon={Layers} />
          <ComposerAction label="Date Range" icon={CalendarDays} />
          <ComposerAction label="Data Sources" icon={Layers} />
          {isWorkspaceMode && (
            <div className="ml-auto flex items-center gap-3">
              <ComposerIconButtons
                canSubmit={Boolean(selectedImage || hasTemporalPair)}
                fileInputRef={fileInputRef}
                onSubmit={onSubmit}
                isLoading={isLoading}
              />
            </div>
          )}
        </div>

        {hasTemporalImage && (
          <div className="mt-3 flex flex-wrap items-center gap-2 pl-1 text-xs font-bold text-[#657a8c]">
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

        {isWorkspaceMode && (
          <div className="mt-4 flex items-center gap-4">
            <Sparkles size={23} className="shrink-0 text-[#1f426a]" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={handleKeyDown}
              className="min-w-0 flex-1 bg-transparent text-base font-medium text-[#173452] outline-none placeholder:text-[#173452]"
              placeholder={
                hasTemporalPair
                  ? "Ask a follow-up about changes between T1 and T2..."
                  : "Ask anything about changes, 3D, terrain, water, or history..."
              }
            />
          </div>
        )}
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
    </section>
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
    <article className="mr-auto w-full rounded-[1.25rem] border border-[#c9ddd4] bg-white/94 p-4 text-[#173452] shadow-[0_16px_45px_rgba(16,35,58,0.1)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#0b6048]">
            OrbiVue AI
          </div>
          <div className="mt-1 text-lg font-black text-[#10233a]">{modeLabel}</div>
        </div>
        <span className="rounded-full bg-[#e8f4eb] px-3 py-1 text-xs font-bold text-[#0b6048]">
          {message.mode === "grounding" ? `${boxes.length} highlighted` : "No boxes"}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(240px,40%)_minmax(0,60%)]">
        <div className="min-w-0">
          <GroundingPreview
            imageUrl={message.imageUrl || ""}
            imageName={message.imageName || "Uploaded image"}
            boundingBoxes={boxes}
            className="h-full"
          />
        </div>
        <div className="min-w-0 rounded-2xl border border-[#d8e1dc] bg-[#fbfaf6] p-4">
          <div className="mb-2 text-sm font-extrabold text-[#10233a]">AI analysis / explanation</div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-[#173452]">{message.text}</pre>
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
            className="inline-flex items-center gap-2 rounded-lg border border-[#b7d8c8] bg-white px-3 py-2 text-xs font-black text-[#0b6048] shadow-sm transition hover:bg-[#e8f4eb]"
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
    <article className="mr-auto w-full rounded-[1.25rem] border border-[#c9ddd4] bg-white/95 p-4 text-[#173452] shadow-[0_16px_45px_rgba(16,35,58,0.1)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#0b6048]">
            OrbiVue AI
          </div>
          <div className="mt-1 text-lg font-black text-[#10233a]">
            {analysis.mode === "change_vqa" ? "Change Question" : "Temporal Change Analysis"}
          </div>
        </div>
        <span className="rounded-full bg-[#e8f4eb] px-3 py-1 text-xs font-bold text-[#0b6048]">
          {analysis.changes.length} changes
        </span>
      </div>

      {hasLiveTemporalPair && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setShowVisualCompare((current) => !current)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#b7d8c8] bg-white px-3 py-2 text-xs font-black text-[#0b6048] shadow-sm transition hover:bg-[#e8f4eb]"
            aria-label={showVisualCompare ? "Hide visual before and after comparison" : "Compare before and after images visually"}
          >
            <ArrowLeftRight size={15} />
            Compare Visually
          </button>
        </div>
      )}

      {showVisualCompare && hasLiveTemporalPair && (
        <div className="mb-4">
          <BeforeAfterSlider
            beforeUrl={currentTemporalPreviewUrls.t1}
            afterUrl={currentTemporalPreviewUrls.t2}
            beforeLabel="BEFORE / T1"
            afterLabel="AFTER / T2"
          />
        </div>
      )}

      <div className="mb-4 flex justify-end">
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
          className="inline-flex items-center gap-2 rounded-lg border border-[#b7d8c8] bg-white px-3 py-2 text-xs font-black text-[#0b6048] shadow-sm transition hover:bg-[#e8f4eb]"
          aria-label="Generate OrbiVue temporal analysis report"
        >
          <FileText size={15} />
          Generate Report
        </button>
      </div>

      {shouldShowImages && (
        <div className="grid gap-4 md:grid-cols-2">
          <TemporalImagePreview image={temporalImages.t1} />
          <TemporalImagePreview image={temporalImages.t2} />
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-[#d8e1dc] bg-[#fbfaf6] p-4">
        <div className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#0b6048]">
          OrbiVue Change Analysis
        </div>
        {showSummary && <p className="mt-2 text-sm leading-6 text-[#173452]">{analysis.summary}</p>}
        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-[#173452]">
          {analysis.final_answer}
        </pre>
      </div>

      {analysis.changes.length > 0 && (
        <section className="mt-4">
          <h3 className="text-sm font-black text-[#10233a]">Changes</h3>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
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
    <figure className="min-w-0 rounded-2xl border border-[#d8e1dc] bg-[#fbfaf6] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <figcaption className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#0b6048]">
            {image.label}
          </figcaption>
          <div className="max-w-[260px] truncate text-xs font-semibold text-[#657a8c]">{image.name}</div>
        </div>
        {image.date && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold">{image.date}</span>}
      </div>
      <img
        src={image.url}
        alt={`${image.label} preview`}
        className="block max-h-[300px] w-full rounded-xl object-contain"
      />
    </figure>
  );
}

function ChangeCard({ change }: { change: ChangeAnalysisPayload["changes"][number] }) {
  return (
    <article className="rounded-2xl border border-[#d8e1dc] bg-white/88 p-3 shadow-sm">
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
      <p className="mt-2 text-sm leading-6 text-[#173452]">{change.description}</p>
    </article>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mt-4 rounded-2xl border border-[#d8e1dc] bg-white/78 p-4">
      <h3 className="text-sm font-black text-[#10233a]">{title}</h3>
      <ul className="mt-2 space-y-1.5 text-sm leading-6 text-[#173452]">
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
  onRemoveTemporalImage,
  onReplaceTemporalImage,
  onSwapTemporalImages,
  disabled,
}: {
  temporalImages: TemporalImageState;
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
          fileName={temporalImages.t1.name}
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
          className="inline-flex items-center gap-2 rounded-lg border border-[#b7d8c8] bg-white px-3 py-2 text-xs font-black text-[#0b6048] shadow-sm transition hover:bg-[#e8f4eb] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowLeftRight size={15} />
          Swap
        </button>
      )}
      {temporalImages.t2 ? (
        <TemporalChip
          label="T2 / AFTER"
          fileName={temporalImages.t2.name}
          onRemove={() => onRemoveTemporalImage("t2")}
          onReplace={() => onReplaceTemporalImage("t2")}
          disabled={disabled}
        />
      ) : (
        <button
          type="button"
          onClick={() => onReplaceTemporalImage("t2")}
          disabled={disabled || !temporalImages.t1}
          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-[#b7d8c8] bg-white/80 px-3 py-2.5 text-sm font-black text-[#0b6048] shadow-sm transition hover:bg-[#e8f4eb] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Paperclip size={16} />
          Add T2 / After image
        </button>
      )}
    </div>
  );
}

function TemporalChip({
  label,
  fileName,
  onRemove,
  onReplace,
  disabled,
}: {
  label: string;
  fileName: string;
  onRemove: () => void;
  onReplace: () => void;
  disabled: boolean;
}) {
  return (
    <div className="relative flex max-w-[300px] items-center gap-3 rounded-xl border border-[#b7d8c8] bg-[#e8f4eb] px-3 py-2.5 pr-9 text-sm text-[#0b6048] shadow-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#0b6048] shadow-inner">
        <Paperclip size={18} />
      </span>
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
}: {
  label: string;
  icon: LucideIcon;
}) {
  return (
    <button className="inline-flex items-center gap-2 rounded-lg border border-[#d8e1dc] bg-white px-3 py-1.5 text-[0.82rem] font-semibold text-[#1f426a] shadow-sm">
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
        className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#d9ddd8] bg-white text-[#14233a] shadow-sm transition hover:border-[#0b7b5b] hover:text-[#0b7b5b]"
        aria-label="Attach image"
      >
        <Paperclip size={19} />
      </button>
      <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d9ddd8] bg-white text-[#14233a] shadow-sm">
        <Mic size={20} />
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={isLoading || !canSubmit}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0b7b5b] text-white shadow-[0_12px_30px_rgba(11,123,91,0.28)] transition hover:bg-[#075f47] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/45 border-t-white" />
        ) : (
          <Send size={19} />
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
