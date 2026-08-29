import type { BoundingBox } from "./workspaceTypes";

type GroundingPreviewProps = {
  imageUrl: string;
  imageName: string;
  boundingBoxes?: BoundingBox[];
  className?: string;
};

const GROUNDING_COLOR = "#ff2d2d";

export function GroundingPreview({
  imageUrl,
  imageName,
  boundingBoxes = [],
  className = "",
}: GroundingPreviewProps) {
  const showGrounding = boundingBoxes.length > 0;

  return (
    <div className={`rounded-2xl border border-[#b7d8c8] bg-white/90 p-3 shadow-sm ${className}`}>
      <div className="relative mx-auto inline-block max-w-full align-top">
        <img
          src={imageUrl}
          alt={`${imageName} visual preview`}
          className="block max-h-[360px] max-w-full rounded-xl object-contain"
        />
        {showGrounding && (
          <>
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {boundingBoxes.map((item, index) => {
                const [ymin, xmin, ymax, xmax] = item.box;
                const left = xmin * 100;
                const top = ymin * 100;
                const width = (xmax - xmin) * 100;
                const height = (ymax - ymin) * 100;

                return (
                  <rect
                    key={`${item.label}-${index}`}
                    x={left}
                    y={top}
                    width={width}
                    height={height}
                    fill="rgba(255, 45, 45, 0.08)"
                    stroke={GROUNDING_COLOR}
                    strokeWidth={4}
                    vectorEffect="non-scaling-stroke"
                    rx={0.7}
                  />
                );
              })}
            </svg>
            {boundingBoxes.map((item, index) => {
              const [ymin, xmin] = item.box;
              const labelTop = ymin * 100;

              return (
                <span
                  key={`${item.label}-${index}-label`}
                  className="pointer-events-none absolute z-10 max-w-[70%] truncate rounded-md px-2 py-1 text-[11px] font-extrabold leading-none text-white shadow-lg"
                  style={{
                    left: `${xmin * 100}%`,
                    top: labelTop < 8 ? `calc(${labelTop}% + 5px)` : `${labelTop}%`,
                    transform: labelTop < 8 ? "none" : "translateY(calc(-100% - 5px))",
                    backgroundColor: GROUNDING_COLOR,
                  }}
                >
                  {item.label}
                </span>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
