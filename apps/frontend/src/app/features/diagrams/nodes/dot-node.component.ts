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
      <span class="dot-wrap">
        <span class="dot" [style.background]="node().data.color || '#03a9f4'"></span>
        <ng-diagram-port id="top" type="both" side="top" class="port-marker port-top" />
        <ng-diagram-port id="right" type="both" side="right" class="port-marker port-right" />
        <ng-diagram-port id="bottom" type="both" side="bottom" class="port-marker port-bottom" />
        <ng-diagram-port id="left" type="both" side="left" class="port-marker port-left" />
      </span>
      <span class="label">{{ node().data.label }}</span>
    </div>
  `,
  styles: `
    .dot-node {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px;
    }
    .dot-wrap {
      position: relative;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }
    .dot {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      pointer-events: none;
    }
    .port-marker {
      /* invisible hit zones around the dot's edge, one per direction,
         instead of a single port that only connects from one side */
      position: absolute;
      --ngd-port-size: 8px;
      --ngd-port-background-color: transparent;
      --ngd-port-border-size: 0;
    }
    .port-top {
      top: -3px;
      left: 50%;
      transform: translateX(-50%);
    }
    .port-bottom {
      bottom: -3px;
      left: 50%;
      transform: translateX(-50%);
    }
    .port-left {
      left: -3px;
      top: 50%;
      transform: translateY(-50%);
    }
    .port-right {
      right: -3px;
      top: 50%;
      transform: translateY(-50%);
    }
    .label {
      font-size: 12px;
      color: var(--primary-text-color);
      white-space: nowrap;
    }
  `,
})
export class DotNodeComponent implements NgDiagramNodeTemplate<DotNodeData> {
  readonly node = input.required<NgNode<DotNodeData>>();
}
