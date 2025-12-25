import React, { useEffect, useMemo, useRef, useState } from "react";
import type { OverlayItem } from "./types";
import { clamp } from "./tools";

type Props = {
  baseImageUrl?: string;        // uploaded photo (object URL) or sample
  overlays: OverlayItem[];
  setOverlays: React.Dispatch<React.SetStateAction<OverlayItem[]>>;
};

type DragState =
  | { id: string; offsetX: number; offsetY: number }
  | null;

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

export default function CanvasStage({ baseImageUrl, overlays, setOverlays }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [drag, setDrag] = useState<DragState>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [baseImg, setBaseImg] = useState<HTMLImageElement | null>(null);
  const [overlayImgs, setOverlayImgs] = useState<Record<string, HTMLImageElement>>({});

  const dpr = window.devicePixelRatio || 1;

  // Load base image
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!baseImageUrl) {
        setBaseImg(null);
        return;
      }
      const img = await loadImage(baseImageUrl);
      if (!cancelled) setBaseImg(img);
    })().catch(() => setBaseImg(null));
    return () => {
      cancelled = true;
    };
  }, [baseImageUrl]);

  // Load overlay images
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = overlays
        .filter(o => o.kind === "image" && o.src)
        .map(o => [o.id, o.src!] as const);

      const needed = entries.filter(([id]) => !overlayImgs[id]);

      if (needed.length === 0) return;

      const loadedPairs = await Promise.all(
        needed.map(async ([id, src]) => [id, await loadImage(src)] as const)
      );

      if (!cancelled) {
        setOverlayImgs(prev => {
          const next = { ...prev };
          for (const [id, img] of loadedPairs) next[id] = img;
          return next;
        });
      }
    })().catch(() => void 0);

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlays]);

  const stageSize = useMemo(() => {
    // Responsive stage: fit container width, keep 1:1 for now
    const w = containerRef.current?.clientWidth ?? 600;
    const size = clamp(w, 320, 900);
    return { w: size, h: size };
  }, [containerRef.current?.clientWidth]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w, h } = stageSize;

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // background
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, w, h);

    // base image centered and "cover" style
    if (baseImg) {
      const iw = baseImg.naturalWidth;
      const ih = baseImg.naturalHeight;
      const scale = Math.max(w / iw, h / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      ctx.drawImage(baseImg, dx, dy, dw, dh);
    } else {
      // fallback placeholder
      ctx.fillStyle = "#222";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#bbb";
      ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText("Upload a photo to start", 20, 30);
    }

    // overlays
    for (const o of overlays) {
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.rotation);
      ctx.scale(o.scale, o.scale);

      if (o.kind === "image" && o.src) {
        const img = overlayImgs[o.id];
        if (img) {
          const ow = img.naturalWidth;
          const oh = img.naturalHeight;
          // draw centered
          ctx.drawImage(img, -ow / 2, -oh / 2, ow, oh);

          if (o.id === selectedId) {
            ctx.strokeStyle = "rgba(255,255,255,0.8)";
            ctx.lineWidth = 2;
            ctx.strokeRect(-ow / 2, -oh / 2, ow, oh);
          }
        }
      } else if (o.kind === "text" && o.text) {
        ctx.fillStyle = "white";
        ctx.font = "48px Impact, system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(o.text, 0, 0);

        if (o.id === selectedId) {
          ctx.strokeStyle = "rgba(255,255,255,0.8)";
          ctx.lineWidth = 2;
          ctx.strokeRect(-150, -35, 300, 70);
        }
      }

      ctx.restore();
    }
  }, [baseImg, overlays, overlayImgs, stageSize, dpr, selectedId]);

  function getPointerPos(e: React.PointerEvent) {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // Basic hit test: treat selected overlay as draggable; otherwise pick nearest overlay center.
  function pickOverlay(x: number, y: number) {
    if (overlays.length === 0) return null;
    let best: { id: string; dist: number } | null = null;
    for (const o of overlays) {
      const dx = o.x - x;
      const dy = o.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (!best || dist < best.dist) best = { id: o.id, dist };
    }
    // threshold so we don't select when clicking far away
    return best && best.dist < 120 ? best.id : null;
  }

  function onPointerDown(e: React.PointerEvent) {
    const p = getPointerPos(e);
    const id = pickOverlay(p.x, p.y);
    setSelectedId(id);
    if (!id) return;

    const o = overlays.find(x => x.id === id);
    if (!o) return;

    setDrag({ id, offsetX: p.x - o.x, offsetY: p.y - o.y });
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const p = getPointerPos(e);
    setOverlays(prev =>
      prev.map(o =>
        o.id === drag.id
          ? { ...o, x: p.x - drag.offsetX, y: p.y - drag.offsetY }
          : o
      )
    );
  }

  function onPointerUp(e: React.PointerEvent) {
    setDrag(null);
    try {
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  // Zoom selected with wheel; rotate with shift+wheel
  function onWheel(e: React.WheelEvent) {
    if (!selectedId) return;
    e.preventDefault();
    const delta = Math.sign(e.deltaY);

    setOverlays(prev =>
      prev.map(o => {
        if (o.id !== selectedId) return o;
        if (e.shiftKey) {
          return { ...o, rotation: o.rotation + delta * 0.08 };
        }
        const nextScale = clamp(o.scale * (delta > 0 ? 0.92 : 1.08), 0.2, 4);
        return { ...o, scale: nextScale };
      })
    );
  }

  return (
    <div ref={containerRef} style={{ width: "100%", maxWidth: 900 }}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        style={{
          width: "100%",
          touchAction: "none",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "#111",
        }}
      />
      <div style={{ marginTop: 8, color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
        Tip: Overlay anklicken, ziehen. Mausrad = skalieren. Shift+Mausrad = rotieren.
      </div>
    </div>
  );
}