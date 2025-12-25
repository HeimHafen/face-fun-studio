import React, { useMemo, useState } from "react";
import CanvasStage from "./editor/CanvasStage";
import type { OverlayItem } from "./editor/types";
import { uid } from "./editor/tools";

const overlayCatalog = [
  { name: "Mustache", src: "/overlays/mustache.png" },
  { name: "Glasses", src: "/overlays/glasses.png" },
  { name: "Hat", src: "/overlays/hat.png" },
];

export default function App() {
  const [baseUrl, setBaseUrl] = useState<string | undefined>("/sample-face.jpg");
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);

  const canExport = useMemo(() => true, []);

  function onUpload(file: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setBaseUrl(url);
  }

  function addOverlay(src: string) {
    setOverlays(prev => [
      ...prev,
      {
        id: uid("ov"),
        kind: "image",
        x: 300,
        y: 300,
        scale: 0.6,
        rotation: 0,
        src,
      },
    ]);
  }

  function addText() {
    setOverlays(prev => [
      ...prev,
      {
        id: uid("txt"),
        kind: "text",
        x: 300,
        y: 80,
        scale: 1,
        rotation: 0,
        text: "LOL",
      },
    ]);
  }

  function removeLast() {
    setOverlays(prev => prev.slice(0, -1));
  }

  function clearAll() {
    setOverlays([]);
  }

  function exportPng() {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = "funny-face.png";
    a.href = (canvas as HTMLCanvasElement).toDataURL("image/png");
    a.click();
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0f", color: "white" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Face Fun Studio</h1>
        <p style={{ marginTop: 8, color: "rgba(255,255,255,0.7)" }}>
          Upload ein Foto, füge Overlays hinzu, exportiere als PNG.
        </p>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "inline-block" }}>
            <input
              type="file"
              accept="image/*"
              onChange={e => onUpload(e.target.files?.[0] ?? null)}
            />
          </label>

          {overlayCatalog.map(o => (
            <button key={o.name} onClick={() => addOverlay(o.src)}>
              + {o.name}
            </button>
          ))}

          <button onClick={addText}>+ Text</button>
          <button onClick={removeLast}>Undo</button>
          <button onClick={clearAll}>Clear</button>

          <button onClick={exportPng} disabled={!canExport}>
            Export PNG
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <CanvasStage baseImageUrl={baseUrl} overlays={overlays} setOverlays={setOverlays} />
        </div>

        <div style={{ marginTop: 18, color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
          Hinweis: Lege Overlays in <code>public/overlays</code> ab. Für den Start reichen 3–10 PNGs.
        </div>
      </div>
    </div>
  );
}