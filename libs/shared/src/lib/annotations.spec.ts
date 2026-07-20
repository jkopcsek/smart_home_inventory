import { PlanAnnotationsSchema } from './annotations';

describe('PlanAnnotationsSchema', () => {
  it('accepts a full round-trip of all annotation kinds', () => {
    const value = {
      version: 1,
      items: [
        { id: 'p1', kind: 'pin', x: 0.5, y: 0.25, deviceId: 'dev1', label: 'Lamp' },
        { id: 'r1', kind: 'rect', x: 0.1, y: 0.1, w: 0.2, h: 0.15, label: 'Fuse box' },
        {
          id: 'l1',
          kind: 'polyline',
          points: [
            { x: 0, y: 0 },
            { x: 0.5, y: 0.5 },
            { x: 1, y: 0.5 },
          ],
          connectionType: 'electrical',
          color: '#ff0000',
        },
        { id: 't1', kind: 'label', x: 0.9, y: 0.9, text: 'Kitchen', fontSize: 14 },
      ],
    };
    const parsed = PlanAnnotationsSchema.parse(value);
    expect(parsed).toEqual(value);
  });

  it('rejects out-of-range coordinates', () => {
    expect(
      PlanAnnotationsSchema.safeParse({
        version: 1,
        items: [{ id: 'p1', kind: 'pin', x: 1.2, y: 0 }],
      }).success
    ).toBe(false);
  });

  it('rejects polylines with fewer than 2 points', () => {
    expect(
      PlanAnnotationsSchema.safeParse({
        version: 1,
        items: [{ id: 'l1', kind: 'polyline', points: [{ x: 0, y: 0 }] }],
      }).success
    ).toBe(false);
  });

  it('rejects unknown kinds', () => {
    expect(
      PlanAnnotationsSchema.safeParse({
        version: 1,
        items: [{ id: 'x', kind: 'arrow', x: 0, y: 0 }],
      }).success
    ).toBe(false);
  });

  it('rejects empty label text', () => {
    expect(
      PlanAnnotationsSchema.safeParse({
        version: 1,
        items: [{ id: 't', kind: 'label', x: 0, y: 0, text: '' }],
      }).success
    ).toBe(false);
  });
});
