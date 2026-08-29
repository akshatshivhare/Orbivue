export type MapMode = "2d" | "3d";

export interface Tool {
  id: string;
  label: string;
  description: string;
}

export interface ChatMessage {
  id: number;
  role: "assistant" | "user";
  text: string;
}
