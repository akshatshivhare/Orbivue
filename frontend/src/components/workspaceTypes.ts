export type BoundingBox = {
  label: string;
  box: [number, number, number, number];
};

export type AnalysisMode = "analysis" | "grounding" | "change_analysis" | "change_vqa" | "cross_modal" | null;

export type TemporalImageSlot = "t1" | "t2";

export type TemporalImageState = Record<TemporalImageSlot, File | null>;

export type TemporalImagePreviews = Record<TemporalImageSlot, string>;

export type CompareMode = "temporal" | "cross_modal";

export type CrossModalImageSlot = "optical" | "sar";

export type CrossModalImageState = Record<CrossModalImageSlot, File | null>;

export type CrossModalImagePreviews = Record<CrossModalImageSlot, string>;

export type SatelliteImageryMetadata = {
  locationName: string;
  lat: number;
  lon: number;
  provider: string;
  product?: string;
  date: string;
  cloudCover?: number | null;
  quality?: string;
  resolutionNote?: string;
};

export type TemporalImageryMetadata = Record<TemporalImageSlot, SatelliteImageryMetadata | null>;

export type ChangeDirection =
  | "increased"
  | "decreased"
  | "appeared"
  | "disappeared"
  | "expanded"
  | "contracted"
  | "altered"
  | "modified"
  | "unchanged"
  | "uncertain"
  | string;

export type ChangeObservability = "clearly_visible" | "possible" | "not_reliably_observable" | string;

export type ChangeItem = {
  category: string;
  direction: ChangeDirection;
  description: string;
  confidence?: number | null;
  change?: string;
  location?: string;
  observability?: ChangeObservability;
};

export type ChangeGuardStatus = "no_measurable_change" | "measurable_difference" | "incompatible" | string;

export type SemanticVerificationStatus = "deterministic_no_change" | "model_generated_unverified" | string;

export type ChangeGuardPayload = {
  status?: ChangeGuardStatus;
  qwen_called?: boolean;
  exact_match?: boolean;
  mean_absolute_difference?: number | null;
  changed_pixel_fraction?: number | null;
  pixel_change_threshold?: number | null;
  near_identical_mean_threshold?: number | null;
  near_identical_fraction_threshold?: number | null;
  semantic_verification?: SemanticVerificationStatus;
  dimension_normalized?: boolean;
  original_size_t1?: [number, number] | null;
  original_size_t2?: [number, number] | null;
  comparison_size?: [number, number] | null;
  normalization_method?: string | null;
  aspect_ratio_t1?: number | null;
  aspect_ratio_t2?: number | null;
  aspect_ratio_relative_difference?: number | null;
  alignment_warning?: string | null;
};

export type ChangeAnalysisPayload = {
  mode: "change_analysis" | "change_vqa";
  summary: string;
  final_answer: string;
  changes: ChangeItem[];
  unchanged: string[];
  unchanged_features?: string[];
  possible_imaging_effects?: string[];
  limitations: string[];
  change_map?: string | null;
  change_guard?: ChangeGuardPayload | null;
};

export type TemporalMessageImage = {
  name: string;
  url: string;
  label: string;
  date?: string;
};

export type CrossModalMessageImage = {
  name: string;
  url: string;
  label: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  query?: string;
  generatedAt?: string;
  imageUrl?: string;
  imageName?: string;
  satelliteImagery?: SatelliteImageryMetadata;
  mode?: AnalysisMode;
  boundingBoxes?: BoundingBox[];
  temporalImages?: {
    t1: TemporalMessageImage;
    t2: TemporalMessageImage;
  };
  temporalImagery?: TemporalImageryMetadata;
  crossModalImages?: {
    optical: CrossModalMessageImage;
    sar: CrossModalMessageImage;
  };
  showTemporalImages?: boolean;
  changeAnalysis?: ChangeAnalysisPayload;
};
