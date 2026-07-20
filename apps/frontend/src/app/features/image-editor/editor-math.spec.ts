import { screenToImage, viewScale, zoomAbout } from './editor-math';

describe('editor math', () => {
  const rect = { left: 0, top: 0, width: 800, height: 600 };

  it('round-trips screen → image coordinates at fit zoom', () => {
    const vb = { x: 0, y: 0, w: 1600, h: 1200 };
    // Center of the element must be the center of the image.
    expect(screenToImage(400, 300, rect, vb)).toEqual({ x: 800, y: 600 });
    // Top-left corner maps to viewBox origin (aspect ratios match here).
    expect(screenToImage(0, 0, rect, vb)).toEqual({ x: 0, y: 0 });
  });

  it('accounts for letterboxing when aspect ratios differ', () => {
    // Wide viewBox in a 4:3 element → vertical letterboxing.
    const vb = { x: 0, y: 0, w: 1600, h: 400 };
    const scale = viewScale(rect, vb); // 800/1600 = 0.5
    expect(scale).toBe(0.5);
    // Vertical offset = (600 - 400*0.5)/2 = 200 → clientY 200 is image y 0.
    expect(screenToImage(0, 200, rect, vb).y).toBeCloseTo(0);
    expect(screenToImage(0, 400, rect, vb).y).toBeCloseTo(400);
  });

  it('zoomAbout keeps the anchor point stationary', () => {
    const vb = { x: 0, y: 0, w: 1000, h: 750 };
    const anchor = { x: 250, y: 300 };
    const zoomed = zoomAbout(vb, anchor, 0.5, { minW: 10, maxW: 4000 });
    // Anchor's relative position inside the box must be unchanged.
    expect((anchor.x - zoomed.x) / zoomed.w).toBeCloseTo((anchor.x - vb.x) / vb.w);
    expect((anchor.y - zoomed.y) / zoomed.h).toBeCloseTo((anchor.y - vb.y) / vb.h);
    expect(zoomed.w).toBe(500);
  });

  it('zoomAbout clamps to limits', () => {
    const vb = { x: 0, y: 0, w: 1000, h: 750 };
    const zoomed = zoomAbout(vb, { x: 0, y: 0 }, 100, { minW: 50, maxW: 2000 });
    expect(zoomed.w).toBe(2000);
  });
});
