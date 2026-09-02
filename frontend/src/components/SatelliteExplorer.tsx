import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  Loader2,
  LocateFixed,
  MapPin,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { apiUrl } from "../config/api";
import type { SatelliteImageryMetadata } from "./workspaceTypes";

type LocationResult = {
  display_name: string;
  lat: number;
  lon: number;
};

type ImageryDate = {
  date: string;
  cloud_cover?: number | null;
  quality?: string;
};

type LatestImagery = {
  provider: string;
  product?: string;
  collection?: string;
  selected_preview_date?: string | null;
  latest_observation_date?: string | null;
  preview_url?: string | null;
  cloud_cover?: number | null;
  preview_quality?: string;
  quality?: string;
  resolution_note?: string;
  fallback_used?: boolean;
};

type AvailabilityResponse = {
  provider: string;
  product?: string;
  available_dates?: ImageryDate[];
  fallback_used?: boolean;
};

type SelectedDate = ImageryDate & {
  provider: string;
  product?: string;
  resolution_note?: string;
};

type SatelliteExplorerProps = {
  onClose: () => void;
  onUseSingleImage: (file: File, metadata: SatelliteImageryMetadata) => void;
  onUseTemporalImages: (
    beforeFile: File,
    beforeMetadata: SatelliteImageryMetadata,
    afterFile: File,
    afterMetadata: SatelliteImageryMetadata
  ) => void;
};

const DEFAULT_MAP_CENTER = { lat: 20, lon: 78 };
const MAP_ZOOM = 10;

function resolvePreviewUrl(previewUrl?: string | null) {
  if (!previewUrl) {
    return "";
  }

  if (/^https?:\/\//i.test(previewUrl)) {
    return previewUrl;
  }

  return apiUrl(previewUrl);
}

function monthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function monthEnd(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0);
}

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatCloud(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "Unknown";
  }

  return `${Number(value).toFixed(value < 1 ? 2 : 1)}%`;
}

function providerLabel(provider?: string, fallbackUsed?: boolean) {
  if (provider === "nasa-viirs" || fallbackUsed) {
    return "NASA VIIRS fallback";
  }

  if (provider === "sentinel-2") {
    return "Sentinel-2";
  }

  return provider || "Satellite imagery";
}

function qualityClass(quality?: string) {
  switch (quality) {
    case "good":
      return "bg-[#0b7b5b] text-white";
    case "fair":
      return "bg-[#e7a52f] text-[#2c230c]";
    case "poor":
      return "bg-[#c85b4b] text-white";
    default:
      return "bg-[#d8ddd7] text-[#263c50]";
  }
}

function qualityDotClass(quality?: string) {
  switch (quality) {
    case "good":
      return "bg-[#0b7b5b]";
    case "fair":
      return "bg-[#e7a52f]";
    case "poor":
      return "bg-[#b86b64]";
    default:
      return "bg-[#9ca8a2]";
  }
}

function sanitizeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
}

function fileExtension(contentType: string) {
  if (contentType.includes("png")) {
    return "png";
  }
  if (contentType.includes("webp")) {
    return "webp";
  }
  return "jpg";
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : "Satellite imagery request failed.");
  }

  return data as T;
}

function latLonToPoint(lat: number, lon: number, zoom: number) {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const scale = 256 * 2 ** zoom;

  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

function pointToLatLon(x: number, y: number, zoom: number) {
  const scale = 256 * 2 ** zoom;
  const lon = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

  return { lat, lon };
}

function tileUrl(x: number, y: number, zoom: number) {
  const max = 2 ** zoom;
  const wrappedX = ((x % max) + max) % max;
  const clampedY = Math.max(0, Math.min(max - 1, y));

  return `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${clampedY}.png`;
}

export function SatelliteExplorer({ onClose, onUseSingleImage, onUseTemporalImages }: SatelliteExplorerProps) {
  const [entryMode, setEntryMode] = useState<"search" | "map">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const [viewedMonth, setViewedMonth] = useState(() => monthStart(new Date()));
  const [latestImagery, setLatestImagery] = useState<LatestImagery | null>(null);
  const [availableDates, setAvailableDates] = useState<ImageryDate[]>([]);
  const [selectedDates, setSelectedDates] = useState<SelectedDate[]>([]);
  const [status, setStatus] = useState({
    search: false,
    latest: false,
    availability: false,
    using: false,
  });
  const [error, setError] = useState("");
  const [selectionNotice, setSelectionNotice] = useState("");

  const availableByDate = useMemo(() => {
    return new Map(availableDates.map((item) => [item.date, item]));
  }, [availableDates]);

  const previewUrl = resolvePreviewUrl(latestImagery?.preview_url);

  const locationLabel = selectedLocation?.display_name.split(",").slice(0, 2).join(", ") || "Selected location";

  const setLoading = (key: keyof typeof status, value: boolean) => {
    setStatus((current) => ({ ...current, [key]: value }));
  };

  const selectLocation = (location: LocationResult) => {
    setSelectedLocation(location);
    setSearchResults([]);
    setSelectedDates([]);
    setSelectionNotice("");
    setError("");
    setViewedMonth(monthStart(new Date()));
  };

  const runLocationSearch = async () => {
    const query = searchQuery.trim();
    if (!query || status.search) {
      return;
    }

    setLoading("search", true);
    setError("");

    try {
      const data = await fetchJson<LocationResult[]>(apiUrl(`/api/location/search?q=${encodeURIComponent(query)}`));
      setSearchResults(data.slice(0, 5));
      if (data.length === 0) {
        setError("No matching location found.");
      }
    } catch {
      setError("Location search failed. Please try again.");
    } finally {
      setLoading("search", false);
    }
  };

  useEffect(() => {
    if (!selectedLocation) {
      return;
    }

    const controller = new AbortController();
    const loadLatest = async () => {
      setLoading("latest", true);
      setError("");

      try {
        const data = await fetchJson<LatestImagery>(
          apiUrl(`/api/location-imagery/latest?lat=${selectedLocation.lat}&lon=${selectedLocation.lon}`),
          controller.signal
        );
        setLatestImagery(data);
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setLatestImagery(null);
          setError(requestError instanceof Error ? requestError.message : "No satellite imagery found for this area.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading("latest", false);
        }
      }
    };

    void loadLatest();

    return () => controller.abort();
  }, [selectedLocation]);

  useEffect(() => {
    if (!selectedLocation) {
      return;
    }

    const controller = new AbortController();
    const loadAvailability = async () => {
      setLoading("availability", true);

      try {
        const start = isoDate(monthStart(viewedMonth));
        const end = isoDate(monthEnd(viewedMonth));
        const data = await fetchJson<AvailabilityResponse>(
          apiUrl(
            `/api/location-imagery/availability?lat=${selectedLocation.lat}&lon=${selectedLocation.lon}&start=${start}&end=${end}`
          ),
          controller.signal
        );
        setAvailableDates(data.available_dates ?? []);
      } catch {
        if (!controller.signal.aborted) {
          setAvailableDates([]);
          setError("No satellite imagery found for this area/month.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading("availability", false);
        }
      }
    };

    void loadAvailability();

    return () => controller.abort();
  }, [selectedLocation, viewedMonth]);

  const selectImageryDate = (imageryDate: ImageryDate) => {
    if (!latestImagery) {
      return;
    }

    setSelectionNotice("");
    setSelectedDates((current) => {
      if (current.some((item) => item.date === imageryDate.date)) {
        return current.filter((item) => item.date !== imageryDate.date);
      }

      if (current.length >= 2) {
        setSelectionNotice("You can select up to 2 dates. Deselect one date to choose another.");
        return current;
      }

      return [
        ...current,
        {
          ...imageryDate,
          provider: latestImagery.provider,
          product: latestImagery.product,
          resolution_note: latestImagery.resolution_note,
        },
      ].sort((a, b) => a.date.localeCompare(b.date));
    });
  };

  const useLatestImage = () => {
    if (!latestImagery?.selected_preview_date) {
      return;
    }

    selectImageryDate({
      date: latestImagery.selected_preview_date,
      cloud_cover: latestImagery.cloud_cover,
      quality: latestImagery.preview_quality ?? latestImagery.quality,
    });
  };

  const buildMetadata = (imageryDate: SelectedDate): SatelliteImageryMetadata => ({
    locationName: locationLabel,
    lat: selectedLocation?.lat ?? 0,
    lon: selectedLocation?.lon ?? 0,
    provider: imageryDate.provider,
    product: imageryDate.product,
    date: imageryDate.date,
    cloudCover: imageryDate.cloud_cover,
    quality: imageryDate.quality,
    resolutionNote: imageryDate.resolution_note,
  });

  const fetchPreviewFile = async (imageryDate: SelectedDate) => {
    if (!selectedLocation) {
      throw new Error("Select a location first.");
    }

    const url = apiUrl(
      `/api/location-imagery/preview?lat=${selectedLocation.lat}&lon=${selectedLocation.lon}&date=${imageryDate.date}&provider=${imageryDate.provider}`
    );
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Preview fetch failed. Please retry.");
    }

    const blob = await response.blob();
    const locationSlug = sanitizeFilename(locationLabel) || `${selectedLocation.lat.toFixed(3)}-${selectedLocation.lon.toFixed(3)}`;
    const providerSlug = imageryDate.provider === "nasa-viirs" ? "nasa-viirs" : "sentinel2";
    const extension = fileExtension(blob.type);

    return new File([blob], `${providerSlug}-${locationSlug}-${imageryDate.date}.${extension}`, {
      type: blob.type || "image/jpeg",
      lastModified: Date.now(),
    });
  };

  const useSelectedImagery = async () => {
    if (!selectedLocation || selectedDates.length === 0 || status.using) {
      return;
    }

    setLoading("using", true);
    setError("");

    try {
      if (selectedDates.length === 1) {
        const [dateSelection] = selectedDates;
        const file = await fetchPreviewFile(dateSelection);
        onUseSingleImage(file, buildMetadata(dateSelection));
        return;
      }

      const [beforeDate, afterDate] = selectedDates;
      const [beforeFile, afterFile] = await Promise.all([
        fetchPreviewFile(beforeDate),
        fetchPreviewFile(afterDate),
      ]);
      onUseTemporalImages(beforeFile, buildMetadata(beforeDate), afterFile, buildMetadata(afterDate));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Preview fetch failed. Please retry.");
    } finally {
      setLoading("using", false);
    }
  };

  return (
    <section className="satellite-explorer flex h-full w-full max-w-[1320px] min-h-0 flex-col rounded-[1.15rem] border border-[#a9c9ba] bg-[#fbfaf6]/94 p-3.5 text-[#10233a] shadow-[0_18px_56px_rgba(2,16,26,0.28)] backdrop-blur-md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-[#dcece2] px-3 py-1 text-xs font-black text-[#074d3b]">
            <Sparkles size={14} />
            Satellite Explorer
          </div>
          <h1 className="mt-1.5 text-xl font-black text-[#0b1d31]">Find satellite imagery by place and date</h1>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg border border-[#ccd8d3] bg-white px-3 py-2 text-sm font-black text-[#173452] shadow-sm transition hover:bg-[#e8f4eb]"
        >
          <X size={16} />
          Close
        </button>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="flex min-h-0 flex-col rounded-xl border border-[#c2d6cd] bg-white/84 p-3 shadow-sm">
          <div className="mb-3 inline-flex w-fit rounded-xl border border-[#b7d8c8] bg-white p-0.5 shadow-sm">
            {(["search", "map"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setEntryMode(mode)}
                className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
                  entryMode === mode ? "bg-[#00624b] text-white" : "text-[#0b6048] hover:bg-[#e8f4eb]"
                }`}
              >
                {mode === "search" ? "Search Location" : "Select from Map"}
              </button>
            ))}
          </div>

          {entryMode === "search" && (
            <div className="mb-3">
              <label className="text-xs font-black uppercase tracking-[0.12em] text-[#0b6048]">Search Location</label>
              <div className="mt-1.5 flex gap-2">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void runLocationSearch();
                    }
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-[#ccd8d3] bg-[#fffdf8] px-3 py-2 text-sm font-semibold text-[#14314b] outline-none transition focus:border-[#0b7b5b]"
                  placeholder="Bhopal, Madhya Pradesh"
                />
                <button
                  type="button"
                  onClick={() => void runLocationSearch()}
                  disabled={status.search}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#00624b] px-3 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[#004d3b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {status.search ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  Search
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1">
                  {searchResults.map((result) => (
                    <button
                      type="button"
                      key={`${result.lat}-${result.lon}-${result.display_name}`}
                      onClick={() => selectLocation(result)}
                      className="w-full rounded-lg border border-[#d8ddd7] bg-white px-3 py-2 text-left shadow-sm transition hover:border-[#0b7b5b] hover:bg-[#f2fbf6]"
                    >
                      <span className="block truncate text-sm font-black text-[#0b1d31]">{result.display_name}</span>
                      <span className="mt-0.5 block text-xs font-semibold text-[#657a8c]">
                        {result.lat.toFixed(5)}, {result.lon.toFixed(5)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <SimpleOsmMap selectedLocation={selectedLocation} onSelectLocation={selectLocation} />

          {selectedLocation && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-[#e8f4eb] px-3 py-2 text-sm font-bold text-[#0b6048]">
              <MapPin size={16} />
              <span className="min-w-0 truncate">{locationLabel}</span>
              <span className="text-xs text-[#657a8c]">
                {selectedLocation.lat.toFixed(5)}, {selectedLocation.lon.toFixed(5)}
              </span>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
          <section className="rounded-xl border border-[#c2d6cd] bg-white/88 p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-sm font-black text-[#0b1d31]">Latest / Best Available Image</h2>
              {status.latest && <Loader2 size={17} className="animate-spin text-[#0b7b5b]" />}
            </div>

            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Latest satellite preview"
                className="block aspect-video w-full rounded-lg bg-[#0b222b] object-cover"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-[#a9c9ba] bg-[#f7f4ed] text-sm font-bold text-[#657a8c]">
                {selectedLocation ? "Preview loading or unavailable" : "Select a location to load imagery"}
              </div>
            )}

            {latestImagery && (
              <div className="mt-2 grid gap-1.5 text-xs font-semibold text-[#173452] sm:grid-cols-2">
                <MetadataLine label="Provider" value={providerLabel(latestImagery.provider, latestImagery.fallback_used)} />
                <MetadataLine label="Product" value={latestImagery.product || latestImagery.collection || "Imagery"} />
                <MetadataLine label="Preview date" value={formatDate(latestImagery.selected_preview_date)} />
                <MetadataLine label="Cloud cover" value={formatCloud(latestImagery.cloud_cover)} />
                <MetadataLine label="Quality" value={latestImagery.preview_quality || latestImagery.quality || "unknown"} />
                <MetadataLine label="Resolution" value={latestImagery.resolution_note || "Provided by backend"} />
              </div>
            )}

            {latestImagery?.preview_quality === "poor" && (
              <p className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#fff4e5] px-2.5 py-1.5 text-xs font-bold text-[#8a4b00]">
                <AlertTriangle size={14} />
                Cloudy / low visibility imagery
              </p>
            )}

            <button
              type="button"
              onClick={useLatestImage}
              disabled={!latestImagery?.selected_preview_date}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#00624b] px-3 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[#004d3b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CloudSun size={16} />
              Use Latest Image
            </button>
          </section>

          <section className="rounded-xl border border-[#c2d6cd] bg-white/88 p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setViewedMonth((current) => monthStart(new Date(current.getFullYear(), current.getMonth() - 1, 1)))}
                className="rounded-full border border-[#ccd8d3] bg-white p-1.5 text-[#173452] shadow-sm hover:bg-[#e8f4eb]"
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="text-center">
                <h2 className="text-sm font-black text-[#0b1d31]">
                  {new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(viewedMonth)}
                </h2>
                {status.availability && <p className="text-xs font-semibold text-[#657a8c]">Loading availability...</p>}
              </div>
              <button
                type="button"
                onClick={() => setViewedMonth((current) => monthStart(new Date(current.getFullYear(), current.getMonth() + 1, 1)))}
                className="rounded-full border border-[#ccd8d3] bg-white p-1.5 text-[#173452] shadow-sm hover:bg-[#e8f4eb]"
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <CalendarGrid
              month={viewedMonth}
              availableByDate={availableByDate}
              selectedDates={selectedDates}
              onSelectDate={selectImageryDate}
            />

            <div className="mt-2 flex flex-wrap gap-2 text-[0.72rem] font-bold text-[#657a8c]">
              <Legend label="Good imagery" className="bg-[#0b7b5b]" />
              <Legend label="Fair imagery" className="bg-[#e7a52f]" />
              <Legend label="Cloudy" className="bg-[#b86b64]" />
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full border border-[#9ca8a2]" /> No imagery</span>
            </div>

            {availableDates.length === 0 && selectedLocation && !status.availability && (
              <p className="mt-2 text-xs font-bold text-[#657a8c]">No satellite imagery found for this area/month.</p>
            )}
          </section>

          <section className="rounded-xl border border-[#c2d6cd] bg-white/88 p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-black text-[#0b1d31]">Selected Dates</h2>
              {selectedDates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedDates([])}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#eef4f0] px-2 py-1 text-xs font-black text-[#0b6048] hover:bg-[#dcece2]"
                >
                  <RotateCcw size={13} />
                  Clear
                </button>
              )}
            </div>

            {selectedDates.length === 0 ? (
              <p className="text-sm font-semibold text-[#657a8c]">Pick one or two available imagery dates.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {selectedDates.map((item, index) => (
                  <article key={item.date} className="rounded-lg border border-[#b7d8c8] bg-[#e8f4eb] p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.12em] text-[#0b6048]">
                          {selectedDates.length === 1 ? "Selected Image" : index === 0 ? "T1 / Before" : "T2 / After"}
                        </div>
                        <div className="mt-1 text-sm font-black text-[#0b1d31]">{formatDate(item.date)}</div>
                        <div className="mt-0.5 text-xs font-semibold text-[#657a8c]">Cloud: {formatCloud(item.cloud_cover)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedDates((current) => current.filter((dateItem) => dateItem.date !== item.date))}
                        className="rounded-full bg-white p-1 text-[#173452] shadow-sm hover:bg-[#0b7b5b] hover:text-white"
                        aria-label={`Remove ${item.date}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {selectionNotice && <p className="mt-2 text-xs font-bold text-[#a15c00]">{selectionNotice}</p>}

            <button
              type="button"
              onClick={() => void useSelectedImagery()}
              disabled={selectedDates.length === 0 || status.using}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#00624b] px-3 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[#004d3b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status.using ? <Loader2 size={17} className="animate-spin" /> : <CalendarDays size={17} />}
              {selectedDates.length === 2 ? "Compare Selected Dates" : "Use Selected Image"}
            </button>
          </section>

          {error && (
            <p className="rounded-xl border border-[#e7aaa4] bg-[#fff4f1] px-3 py-2 text-sm font-bold text-[#9b1c13]">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function SimpleOsmMap({
  selectedLocation,
  onSelectLocation,
}: {
  selectedLocation: LocationResult | null;
  onSelectLocation: (location: LocationResult) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const center = selectedLocation ?? {
    ...DEFAULT_MAP_CENTER,
    display_name: "Map selection",
  };
  const centerPoint = latLonToPoint(center.lat, center.lon, MAP_ZOOM);
  const tileX = Math.floor(centerPoint.x / 256);
  const tileY = Math.floor(centerPoint.y / 256);
  const offsetX = centerPoint.x - tileX * 256;
  const offsetY = centerPoint.y - tileY * 256;
  const tiles = [];

  for (let x = -2; x <= 2; x += 1) {
    for (let y = -2; y <= 2; y += 1) {
      tiles.push({
        key: `${x}-${y}`,
        url: tileUrl(tileX + x, tileY + y, MAP_ZOOM),
        left: `calc(50% + ${(x * 256 - offsetX).toFixed(2)}px)`,
        top: `calc(50% + ${(y * 256 - offsetY).toFixed(2)}px)`,
      });
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) {
      return;
    }

    const clickX = centerPoint.x + event.clientX - bounds.left - bounds.width / 2;
    const clickY = centerPoint.y + event.clientY - bounds.top - bounds.height / 2;
    const point = pointToLatLon(clickX, clickY, MAP_ZOOM);

    onSelectLocation({
      display_name: `Selected map point near ${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`,
      lat: point.lat,
      lon: point.lon,
    });
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      className="relative min-h-[300px] flex-1 cursor-crosshair overflow-hidden rounded-xl border border-[#a9c9ba] bg-[#dcece2] shadow-inner"
      aria-label="Select a location from the map"
      role="button"
      tabIndex={0}
    >
      {tiles.map((tile) => (
        <img
          key={tile.key}
          src={tile.url}
          alt=""
          className="absolute h-64 w-64 max-w-none select-none"
          style={{ left: tile.left, top: tile.top }}
          draggable={false}
          aria-hidden="true"
        />
      ))}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(6,27,34,0.08)_100%)]" />
      {selectedLocation && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center text-[#005b46]">
          <MapPin size={36} fill="#0b7b5b" className="drop-shadow-md" />
          <span className="mt-1 rounded-full bg-white/92 px-2 py-1 text-[0.7rem] font-black shadow-sm">Selected</span>
        </span>
      )}
      {!selectedLocation && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-sm font-black text-[#0b6048] shadow-sm">
            <LocateFixed size={16} />
            Click anywhere to select a location
          </span>
        </div>
      )}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-2 right-2 rounded bg-white/90 px-2 py-1 text-[0.65rem] font-bold text-[#173452] shadow-sm"
        onPointerDown={(event) => event.stopPropagation()}
      >
        © OpenStreetMap
      </a>
    </div>
  );
}

function CalendarGrid({
  month,
  availableByDate,
  selectedDates,
  onSelectDate,
}: {
  month: Date;
  availableByDate: Map<string, ImageryDate>;
  selectedDates: SelectedDate[];
  onSelectDate: (imageryDate: ImageryDate) => void;
}) {
  const days = useMemo(() => {
    const start = monthStart(month);
    const end = monthEnd(month);
    const leading = start.getDay();
    const total = leading + end.getDate();
    const cells = Math.ceil(total / 7) * 7;

    return Array.from({ length: cells }, (_, index) => {
      const day = index - leading + 1;
      if (day < 1 || day > end.getDate()) {
        return null;
      }
      return new Date(month.getFullYear(), month.getMonth(), day);
    });
  }, [month]);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[0.66rem] font-black uppercase tracking-[0.08em] text-[#657a8c]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (!day) {
            return <span key={`empty-${index}`} className="aspect-square" />;
          }

          const dateKey = isoDate(day);
          const imageryDate = availableByDate.get(dateKey);
          const isSelected = selectedDates.some((item) => item.date === dateKey);

          return (
            <button
              key={dateKey}
              type="button"
              disabled={!imageryDate}
              onClick={() => imageryDate && onSelectDate(imageryDate)}
              className={`relative flex aspect-square min-h-9 items-center justify-center rounded-lg border text-sm font-black transition ${
                isSelected
                  ? "border-[#00624b] bg-[#00624b] text-white shadow-sm"
                  : imageryDate
                    ? "border-[#b7d8c8] bg-white text-[#0b1d31] hover:border-[#0b7b5b] hover:bg-[#e8f4eb]"
                    : "border-transparent bg-[#f3f1ec]/60 text-[#9aa6a0]"
              } disabled:cursor-not-allowed`}
              title={imageryDate ? `${dateKey} • ${imageryDate.quality || "unknown"} • Cloud ${formatCloud(imageryDate.cloud_cover)}` : "No imagery"}
            >
              {day.getDate()}
              {imageryDate && (
                <span
                  className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${
                    isSelected ? "bg-white" : qualityDotClass(imageryDate.quality)
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MetadataLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#f7f4ed] px-2.5 py-1.5">
      <span className="block text-[0.64rem] font-black uppercase tracking-[0.1em] text-[#657a8c]">{label}</span>
      <span className="mt-0.5 block truncate font-black text-[#14314b]">{value}</span>
    </div>
  );
}

function Legend({ label, className }: { label: string; className: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${className}`} />
      {label}
    </span>
  );
}
