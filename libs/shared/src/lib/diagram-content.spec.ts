import { DiagramContentSchema, EMPTY_DIAGRAM_CONTENT, NodeDataSchema, NodeLinkSchema } from './diagram-content';

describe('DiagramContentSchema', () => {
  it('accepts a full round-trip of all shapes, link kinds, and an edge', () => {
    const value = {
      schemaVersion: 1 as const,
      nodes: [
        {
          id: 'n1',
          type: 'box' as const,
          position: { x: 0, y: 0 },
          size: { width: 120, height: 60 },
          data: { shape: 'box' as const, label: 'Fuse box', color: '#ff0000' },
        },
        {
          id: 'n2',
          type: 'box' as const,
          position: { x: 200, y: 0 },
          data: {
            shape: 'box' as const,
            label: 'Floor plan',
            link: { kind: 'image' as const, attachmentId: 'att1' },
          },
        },
        {
          id: 'n3',
          type: 'dot' as const,
          position: { x: 400, y: 0 },
          data: { shape: 'dot' as const, link: { kind: 'device' as const, deviceId: 'dev1' } },
        },
        {
          id: 'n4',
          type: 'box' as const,
          position: { x: 600, y: 0 },
          data: { shape: 'box' as const, link: { kind: 'diagram' as const, diagramId: 'diag2' } },
        },
        {
          id: 'n5',
          type: 'box-ports' as const,
          position: { x: 800, y: 0 },
          data: {
            shape: 'box-ports' as const,
            label: 'Hallway switch box',
            ports: [
              { id: 'p1', label: 'L1 in', direction: 'in' as const, type: 'L1' as const },
              { id: 'p2', label: 'Lamp 1', direction: 'out' as const },
              { id: 'p3', label: '+12V', direction: 'in' as const, type: 'DC+' as const },
              { id: 'p4', label: 'Sensor bus', direction: 'in' as const, type: 'dc_24v' as const },
            ],
          },
        },
        {
          id: 'n6',
          type: 'box' as const,
          position: { x: 1000, y: 0 },
          data: { shape: 'box' as const, link: { kind: 'connection' as const, connectionId: 'conn1' } },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          sourcePort: 'p2',
          type: 'wire',
          points: [{ x: 120, y: 30 }, { x: 160, y: 30 }, { x: 160, y: 0 }, { x: 200, y: 0 }],
          routing: 'orthogonal',
          routingMode: 'manual' as const,
          data: { connectionId: 'conn1', label: '230V', color: '#8b5a2b', type: 'L1' as const },
        },
      ],
    };
    const parsed = DiagramContentSchema.parse(value);
    expect(parsed).toEqual(value);
  });

  it('validates the empty-diagram constant', () => {
    expect(DiagramContentSchema.safeParse(EMPTY_DIAGRAM_CONTENT).success).toBe(true);
  });

  it('rejects unknown shapes', () => {
    expect(NodeDataSchema.safeParse({ shape: 'triangle', label: 'x' }).success).toBe(false);
  });

  it('rejects a box-ports payload missing its ports array', () => {
    expect(NodeDataSchema.safeParse({ shape: 'box-ports' }).success).toBe(false);
  });

  it('rejects unknown link kinds and links missing their required id', () => {
    expect(NodeLinkSchema.safeParse({ kind: 'zone', zoneId: 'z1' }).success).toBe(false);
    expect(NodeLinkSchema.safeParse({ kind: 'device' }).success).toBe(false);
  });

  it('rejects an unsupported schemaVersion', () => {
    expect(
      DiagramContentSchema.safeParse({ schemaVersion: 2, nodes: [], edges: [] }).success
    ).toBe(false);
  });

  it('rejects an edge with an invalid routingMode', () => {
    expect(
      DiagramContentSchema.safeParse({
        schemaVersion: 1,
        nodes: [],
        edges: [{ id: 'e1', source: 'n1', target: 'n2', routingMode: 'sometimes' }],
      }).success
    ).toBe(false);
  });

  it('rejects a type that is neither a known wire type nor a known connection type', () => {
    expect(
      DiagramContentSchema.safeParse({
        schemaVersion: 1,
        nodes: [],
        edges: [{ id: 'e1', source: 'n1', target: 'n2', data: { type: 'L4' } }],
      }).success
    ).toBe(false);
    expect(
      NodeDataSchema.safeParse({
        shape: 'box-ports',
        ports: [{ id: 'p1', label: 'x', direction: 'in', type: 'L4' }],
      }).success
    ).toBe(false);
  });
});
