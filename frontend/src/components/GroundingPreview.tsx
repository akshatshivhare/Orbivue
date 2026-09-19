import { useCallback, useEffect, useRef, useState } from "react";
import type { BoundingBox } from "./workspaceTypes";

type GroundingPreviewProps = {
  imageUrl: string;
  imageName: string;
  boundingBoxes?: BoundingBox[];
  className?: string;
};

const GROUNDING_COLOR = "#0b7b5b";
const GROUNDING_FILL = "rgba(11, 123, 91, 0.14)";

type OverlayRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function GroundingPreview({
  imageUrl,
  imageName,
  boundingBoxes = [],
  className = "",
}: GroundingPreviewProps) {
  const showGrounding = boundingBoxes.length > 0;
  const frameRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [overlayRect, setOverlayRect] = useState<OverlayRect | null>(null);

  const measureOverlay = useCallback(() => {
    const frame = frameRef.current;
    const image = imageRef.current;

    if (!frame || !image || !image.naturalWidth || !image.naturalHeight) {
      setOverlayRect(null);
      return;
    }

    const frameBounds = frame.getBoundingClientRect();
    const imageBounds = image.getBoundingClientRect();
    const naturalRatio = image.naturalWidth / image.naturalHeight;
    const renderedRatio = imageBounds.width / imageBounds.height;
    let contentWidth = imageBounds.width;
    let contentHeight = imageBounds.height;
    let contentLeft = imageBounds.left - frameBounds.left;
    let contentTop = imageBounds.top - frameBounds.top;

    if (renderedRatio > naturalRatio) {
      contentWidth = imageBounds.height * naturalRatio;
      contentLeft += (imageBounds.width - contentWidth) / 2;
    } else if (renderedRatio < naturalRatio) {
      contentHeight = imageBounds.width / naturalRatio;
      contentTop += (imageBounds.height - contentHeight) / 2;
    }

    setOverlayRect({
      left: contentLeft,
      top: contentTop,
      width: Math.max(1, contentWidth),
      height: Math.max(1, contentHeight),
    });
  }, []);

  useEffect(() => {
    measureOverlay();

    const frame = frameRef.current;
    const image = imageRef.current;

    if (!frame || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureOverlay);
      return () => window.removeEventListener("resize", measureOverlay);
    }

    const observer = new ResizeObserver(() => measureOverlay());
    observer.observe(frame);
    if (image) {
      observer.observe(image);
    }

    return () => observer.disconnect();
  }, [imageUrl, measureOverlay]);

  return (
    <div className={`grounding-preview rounded-2xl border border-[#b7d8c8] bg-white/90 p-3 shadow-sm ${className}`}>
      <div ref={frameRef} className="relative mx-auto flex max-w-full justify-center align-top">
        <img
          ref={imageRef}
          src={imageUrl}
          alt={`${imageName} visual preview`}
          className="block max-h-[360px] max-w-full rounded-xl object-contain"
          onLoad={measureOverlay}
        />
        {showGrounding && overlayRect && (
          <>
            <svg
              className="pointer-events-none absolute overflow-visible"
              style={{
                left: overlayRect.left,
                top: overlayRect.top,
                width: overlayRect.width,
                height: overlayRect.height,
              }}
              viewBox={`0 0 ${overlayRect.width} ${overlayRect.height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {boundingBoxes.map((item, index) => {
                const [ymin, xmin, ymax, xmax] = item.box;
                const left = xmin * overlayRect.width;
                const top = ymin * overlayRect.height;
                const width = (xmax - xmin) * overlayRect.width;
                const height = (ymax - ymin) * overlayRect.height;

                return (
                  <rect
                    key={`${item.label}-${index}`}
                    x={left}
                    y={top}
                    width={width}
                    height={height}
                    fill={GROUNDING_FILL}
                    stroke={GROUNDING_COLOR}
                    strokeWidth={2.5}
                    vectorEffect="non-scaling-stroke"
                    rx={6}
                  />
                );
              })}
            </svg>
            {boundingBoxes.map((item, index) => {
              const [ymin, xmin] = item.box;
              const labelTop = ymin * overlayRect.height;
              const labelLeft = xmin * overlayRect.width;

              return (
                <span
                  key={`${item.label}-${index}-label`}
                  className="pointer-events-none absolute z-10 max-w-[min(72%,220px)] truncate rounded-md border border-white/55 px-2 py-1 text-[11px] font-extrabold leading-none text-white shadow-[0_6px_18px_rgba(6,27,34,0.25)] backdrop-blur-sm"
                  style={{
                    left: overlayRect.left + labelLeft,
                    top: overlayRect.top + labelTop,
                    transform: labelTop < 26 ? "translate(4px, 5px)" : "translate(4px, calc(-100% - 6px))",
                    backgroundColor: "rgba(7, 95, 71, 0.88)",
                  }}
                >
                  {item.label}
                </span>
            );
            })}
          </>
        )}
        {!showGrounding && (
          <span className="sr-only">No confident localization was produced for this query.</span>
        )}
      </div>
    </div>
  );
}
