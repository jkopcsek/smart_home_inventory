import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Edge as NgEdge, NgDiagramBaseEdgeComponent, NgDiagramEdgeTemplate } from 'ng-diagram';
import { EdgeData } from '@smart-home-inventory/shared';

/**
 * The 'wire' edge template — same look as ng-diagram's default edge, except
 * the stroke follows `data.color` (a real conductor color, e.g. brown/blue/
 * green-yellow) when set, falling back to the library's default gray.
 * Registered for every edge (see `finalEdgeDataBuilder` in DiagramCanvasComponent)
 * so free-standing and connection-linked wires are colorable alike.
 */
@Component({
  selector: 'app-wire-edge',
  imports: [NgDiagramBaseEdgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-diagram-base-edge
      [edge]="edge()"
      [stroke]="strokeColor()"
      [sourceArrowhead]="edge().sourceArrowhead"
      [targetArrowhead]="edge().targetArrowhead"
    />
  `,
})
export class WireEdgeComponent implements NgDiagramEdgeTemplate<EdgeData> {
  edge = input.required<NgEdge<EdgeData>>();

  protected readonly strokeColor = computed(() =>
    this.edge().selected ? 'var(--primary-color)' : this.edge().data?.color || 'var(--ngd-default-edge-stroke)'
  );
}
