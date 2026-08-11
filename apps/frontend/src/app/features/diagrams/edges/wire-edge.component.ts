import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import {
  Edge as NgEdge,
  NgDiagramBaseEdgeComponent,
  NgDiagramBaseEdgeLabelComponent,
  NgDiagramEdgeTemplate,
  Point,
} from 'ng-diagram';
import { mdiLinkVariant } from '@mdi/js';
import { DASH_STYLE_PATTERNS, EdgeData, wireOrCableLabel } from '@smart-home-inventory/shared';
import { ConnectionTypesStore } from '../../../core/connection-types/connection-types.store';
import { IconComponent } from '../../../shared/ui/icon.component';

/**
 * The 'wire' edge template — same look as ng-diagram's default edge, except
 * the stroke follows `data.color` (a real conductor color, e.g. brown/blue/
 * green-yellow) when set, falling back to the library's default gray.
 * Registered for every edge (see `finalEdgeDataBuilder` in DiagramCanvasComponent)
 * so free-standing and connection-linked wires are colorable alike. Also shows
 * the edge's label/type at its midpoint — the properties panel no longer
 * exists in read-only mode, so this is the only place that info is visible.
 */
@Component({
  selector: 'app-wire-edge',
  imports: [NgDiagramBaseEdgeComponent, NgDiagramBaseEdgeLabelComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-diagram-base-edge
      [edge]="edge()"
      [stroke]="strokeColor()"
      [strokeDasharray]="strokeDasharray()"
      [strokeWidth]="strokeWidth()"
      [sourceArrowhead]="edge().sourceArrowhead"
      [targetArrowhead]="edge().targetArrowhead"
    >
      @if (label() || typeLabel() || linked()) {
        <ng-diagram-base-edge-label [id]="edge().id + '-info'" [positionOnEdge]="0.5">
          <div class="edge-info" [style.transform]="labelOffsetTransform()">
            @if (label()) {
              <span class="label">
                {{ label() }}
                @if (linked() && !typeLabel()) {
                  <app-icon class="link-badge" [path]="linkIcon" [size]="11" title="Linked to a real connection" />
                }
              </span>
            }
            @if (typeLabel()) {
              <span class="type">
                {{ typeLabel() }}
                @if (linked()) {
                  <app-icon class="link-badge" [path]="linkIcon" [size]="11" title="Linked to a real connection" />
                }
              </span>
            }
            @if (linked() && !label() && !typeLabel()) {
              <app-icon class="link-badge" [path]="linkIcon" [size]="11" title="Linked to a real connection" />
            }
          </div>
        </ng-diagram-base-edge-label>
      }
    </ng-diagram-base-edge>
  `,
  styles: `
    .edge-info {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      padding: 1px 6px;
      font-size: 11px;
      line-height: 1.3;
      white-space: nowrap;
      pointer-events: none;
    }
    .label {
      color: var(--primary-text-color);
    }
    .type {
      color: color-mix(in srgb, var(--primary-text-color) 75%, black);
    }
    .link-badge {
      margin-left: 3px;
      color: var(--secondary-text-color);
      vertical-align: -1px;
    }
  `,
})
export class WireEdgeComponent implements NgDiagramEdgeTemplate<EdgeData> {
  edge = input.required<NgEdge<EdgeData>>();
  private readonly connectionTypes = inject(ConnectionTypesStore);
  protected readonly linkIcon = mdiLinkVariant;

  /** Accent (not primary) color — primary is also a common conductor wire
   *  color (data.color), so a same-colored selected stroke could blend in. */
  protected readonly strokeColor = computed(() =>
    this.edge().selected ? 'var(--accent-color)' : this.edge().data?.color || 'var(--ngd-default-edge-stroke)'
  );
  protected readonly strokeDasharray = computed(
    () => DASH_STYLE_PATTERNS[this.edge().data?.dash ?? 'solid']
  );
  protected readonly strokeWidth = computed(() => this.edge().data?.width);
  protected readonly label = computed(() => this.edge().data?.label || '');
  protected readonly typeLabel = computed(() => wireOrCableLabel(this.edge().data?.type, this.connectionTypes) || '');
  protected readonly linked = computed(() => !!this.edge().data?.connectionId);

  /** Nudges the label off the wire it's centered on (`positionOnEdge` only
   *  controls the position *along* the edge, not sideways) so the line
   *  doesn't cut through the text. Offsets perpendicular to whichever
   *  segment sits at the midpoint, so it holds up for horizontal, vertical,
   *  and diagonal/orthogonal-routed wires alike. */
  protected readonly labelOffsetTransform = computed(() => {
    const { x, y } = perpendicularOffsetAtMidpoint(this.edge().points, LABEL_OFFSET_PX);
    return `translate(${x}px, ${y}px)`;
  });
}

const LABEL_OFFSET_PX = 12;

function perpendicularOffsetAtMidpoint(rawPoints: Point[] | undefined, offset: number): Point {
  // Orthogonal routing can emit coincident points at a corner (a zero-length
  // segment) — ng-diagram's own point-at-distance math explicitly guards
  // against dividing by that (falls back to ratio 0). Left in, a zero-length
  // segment landing exactly at the midpoint degenerates our direction vector
  // to (0,0), collapsing the whole offset — so drop them before walking.
  const points = rawPoints?.filter((p, i) => i === 0 || p.x !== rawPoints[i - 1].x || p.y !== rawPoints[i - 1].y);
  if (!points || points.length < 2) return { x: 0, y: -offset };

  const segmentLengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  const total = segmentLengths.reduce((sum, len) => sum + len, 0);
  if (total === 0) return { x: 0, y: -offset };

  let remaining = total / 2;
  let segmentIndex = 0;
  while (segmentIndex < segmentLengths.length - 1 && remaining > segmentLengths[segmentIndex]) {
    remaining -= segmentLengths[segmentIndex];
    segmentIndex++;
  }

  const from = points[segmentIndex];
  const to = points[segmentIndex + 1];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;

  // Perpendicular unit vector, canonicalized to point "up" (or left, for a
  // perfectly vertical segment) so the offset direction doesn't flip
  // depending on which end of the wire was drawn as the source.
  let px = -dy / len;
  let py = dx / len;
  if (py > 0) {
    px = -px;
    py = -py;
  }

  return { x: px * offset, y: py * offset };
}
