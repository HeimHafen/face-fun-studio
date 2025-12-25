export type OverlayKind = "image" | "text";

export type OverlayItem = {
  id: string;
  kind: OverlayKind;
  x: number;
  y: number;
  scale: number;
  rotation: number; // radians
  src?: string;     // for image
  text?: string;    // for text
};
