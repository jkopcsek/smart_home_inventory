import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Node as NgNode, NgDiagramNodeTemplate, NgDiagramPortComponent } from 'ng-diagram';
import { DotNodeData } from '@smart-home-inventory/shared';

/** A small labeled marker — the "Dot" shape. What it links to (if anything) is orthogonal. */
@Component({
  selector: 'app-dot-node',
  imports: [NgDiagramPortComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dot-node">
      <span class="dot" [style.background]="node().data.color || '#03a9f4'"></span>
      <span class="label">{{ node().data.label }}</span>
      <ng-diagram-port id="top" side="top" type="both" />
      <ng-diagram-port id="right" side="right" type="both" />
      <ng-diagram-port id="bottom" side="bottom" type="both" />
      <ng-diagram-port id="left" side="left" type="both" />
    </div>
  `,
  styles: `
    .dot-node {
      display: flex;
      align-items: center;
      gap: 6px;
      position: relative;
      padding: 4px;
    }
    .dot {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2px solid var(--card-background-color);
      box-shadow: 0 0 0 1px var(--divider-color);
      flex-shrink: 0;
    }
    .label {
      font-size: 12px;
      color: var(--primary-text-color);
      background: var(--card-background-color);
      border: 1px solid var(--divider-color);
      padding: 2px 8px;
      border-radius: 10px;
      white-space: nowrap;
    }
  `,
})
export class DotNodeComponent implements NgDiagramNodeTemplate<DotNodeData> {
  readonly node = input.required<NgNode<DotNodeData>>();
}
