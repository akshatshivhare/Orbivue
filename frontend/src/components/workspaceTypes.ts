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

export type ChangeDirection =
  | "increased"
  | "decreased"
  | "appeared"
  | "disappeared"
  | "modified"
  | "unchanged"
  | "uncertain"
  | string;

export type ChangeItem = {
  category: string;
  direction: ChangeDirection;
  description: string;
  confidence?: number | null;
};

export type ChangeAnalysisPayload = {
  mode: "change_analysis" | "change_vqa";
  summary: string;
  final_answer: string;
  changes: ChangeItem[];
  unchanged: string[];
  limitations: string[];
  change_map?: string | null;
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
  mode?: AnalysisMode;
  boundingBoxes?: BoundingBox[];
  temporalImages?: {
    t1: TemporalMessageImage;
    t2: TemporalMessageImage;
  };
  crossModalImages?: {
    optical: CrossModalMessageImage;
    sar: CrossModalMessageImage;
  };
  showTemporalImages?: boolean;
  changeAnalysis?: ChangeAnalysisPayload;
};
