/** ViewBox in image-pixel space. */
export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The SVG uses preserveAspectRatio="xMidYMid meet", so the viewBox is
 * letterboxed inside the element. All conversions must account for that.
 */
/** Structural subset of DOMRect so the math is testable without a browser. */
export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function viewScale(rect: RectLike, vb: ViewBox): number {
  return Math.min(rect.width / vb.w, rect.height / vb.h);
}

export function screenToImage(
  clientX: number,
  clientY: number,
  rect: RectLike,
  vb: ViewBox
): { x: number; y: number } {
  const scale = viewScale(rect, vb);
  const offX = (rect.width - vb.w * scale) / 2;
  const offY = (rect.height - vb.h * scale) / 2;
  return {
    x: vb.x + (clientX - rect.left - offX) / scale,
    y: vb.y + (clientY - rect.top - offY) / scale,
  };
}

/** Zoom keeping the image point under the cursor stationary. */
export function zoomAbout(
  vb: ViewBox,
  point: { x: number; y: number },
  factor: number,
  limits: { minW: number; maxW: number }
): ViewBox {
  const w = Math.min(Math.max(vb.w * factor, limits.minW), limits.maxW);
  const actualFactor = w / vb.w;
  const h = vb.h * actualFactor;
  return {
    x: point.x - (point.x - vb.x) * actualFactor,
    y: point.y - (point.y - vb.y) * actualFactor,
    w,
    h,
  };
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function newId(): string {
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
