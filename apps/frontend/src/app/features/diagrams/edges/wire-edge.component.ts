import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import {
  Edge as NgEdge,
  NgDiagramBaseEdgeComponent,
  NgDiagramBaseEdgeLabelComponent,
  NgDiagramEdgeTemplate,
} from 'ng-diagram';
import { EdgeData, wireOrCableLabel } from '@smart-home-inventory/shared';
import { ConnectionTypesStore } from '../../../core/connection-types/connection-types.store';

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
  imports: [NgDiagramBaseEdgeComponent, NgDiagramBaseEdgeLabelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-diagram-base-edge
      [edge]="edge()"
      [stroke]="strokeColor()"
      [sourceArrowhead]="edge().sourceArrowhead"
      [targetArrowhead]="edge().targetArrowhead"
    >
      @if (label() || typeLabel()) {
        <ng-diagram-base-edge-label [id]="edge().id + '-info'" [positionOnEdge]="0.5">
          <div class="edge-info">
            @if (label()) {
              <span class="label">{{ label() }}</span>
            }
            @if (typeLabel()) {
              <span class="type">{{ typeLabel() }}</span>
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
  `,
})
export class WireEdgeComponent implements NgDiagramEdgeTemplate<EdgeData> {
  edge = input.required<NgEdge<EdgeData>>();
  private readonly connectionTypes = inject(ConnectionTypesStore);

  protected readonly strokeColor = computed(() =>
    this.edge().selected ? 'var(--primary-color)' : this.edge().data?.color || 'var(--ngd-default-edge-stroke)'
  );
  protected readonly label = computed(() => this.edge().data?.label || '');
  protected readonly typeLabel = computed(() => wireOrCableLabel(this.edge().data?.type, this.connectionTypes) || '');
}
