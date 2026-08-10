import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Node as NgNode, NgDiagramNodeTemplate, NgDiagramPortComponent } from 'ng-diagram';
import { mdiLinkVariant } from '@mdi/js';
import { DotNodeData } from '@smart-home-inventory/shared';
import { IconComponent } from '../../../shared/ui/icon.component';
import { DEFAULT_NODE_COLOR } from './node-defaults';
import { nodeIconPath } from './node-icons';

/** A small labeled marker — the "Dot" shape. What it links to (if anything) is orthogonal. */
@Component({
  selector: 'app-dot-node',
  imports: [NgDiagramPortComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dot-node">
      <span class="dot-wrap" [class.selected]="node().selected">
        <span class="dot" [style.background]="node().data.color || defaultColor">
          @if (iconPath(); as p) {
            <app-icon class="dot-icon" [path]="p" [size]="10" />
          }
        </span>
        <ng-diagram-port id="top" type="both" side="top" class="port-marker port-top" />
        <ng-diagram-port id="right" type="both" side="right" class="port-marker port-right" />
        <ng-diagram-port id="bottom" type="both" side="bottom" class="port-marker port-bottom" />
        <ng-diagram-port id="left" type="both" side="left" class="port-marker port-left" />
      </span>
      <span class="label">{{ node().data.label || 'Marker' }}</span>
      @if (linked()) {
        <app-icon class="link-badge" [path]="linkIcon" [size]="12" title="Linked to a real item" />
      }
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
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      pointer-events: none;
    }
    .dot-icon {
      color: #fff;
    }
    /* The library's default selection ring only applies via
       ng-diagram-base-node-template, which this custom shape doesn't use —
       draw our own around the dot itself. Accent (not primary) color —
       primary is also the default dot color, so a same-colored ring would
       blend in on an unstyled dot. */
    .dot-wrap.selected .dot {
      box-shadow: 0 0 0 3px var(--accent-color);
    }
    .link-badge {
      flex-shrink: 0;
      color: var(--secondary-text-color);
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
  protected readonly linkIcon = mdiLinkVariant;
  protected readonly defaultColor = DEFAULT_NODE_COLOR;
  protected readonly linked = computed(() => !!this.node().data.link);
  protected readonly iconPath = computed(() => nodeIconPath(this.node().data.icon));
}
