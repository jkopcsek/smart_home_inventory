import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Node as NgNode, NgDiagramBaseNodeTemplateComponent, NgDiagramNodeTemplate, NgDiagramPortComponent } from 'ng-diagram';
import { BoxNodeData } from '@smart-home-inventory/shared';
import { attachmentUrl } from '../../../core/api/api.services';

/**
 * The "Box" shape. With no link (or a device/diagram link) it's a plain
 * labeled, filled box; linked to an image, it renders that photo instead —
 * the same box, different content. Wrapped in ng-diagram-base-node-template
 * so it keeps the default node's selection styling, resize handles and ports
 * (which supplies left/right; top/bottom are added here).
 */
@Component({
  selector: 'app-box-node',
  imports: [NgDiagramBaseNodeTemplateComponent, NgDiagramPortComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-diagram-base-node-template [node]="node()" [style.--ngd-node-border-color]="data().borderColor">
      <div class="content">
        @if (imageUrl(); as url) {
          <img [src]="url" [alt]="data().label || 'Image'" />
          @if (data().label) {
            <div class="image-label">{{ data().label }}</div>
          }
        } @else {
          <div class="box-label" [style.background]="data().color || '#03a9f4'">
            {{ data().label }}
          </div>
        }
        <ng-diagram-port id="top" type="both" side="top" />
        <ng-diagram-port id="bottom" type="both" side="bottom" />
      </div>
    </ng-diagram-base-node-template>
  `,
  styles: `
    :host {
      /* ng-diagram-base-node-template paints its own gray background behind
         our content; drop it so only .box-label's color shows. */
      --ngd-node-bg-primary-default: transparent;
    }
    .content {
      /* cancel the base template's own .5rem padding so the color fills
         the full node instead of leaving its gray background as a border */
      position: relative;
      margin: -0.5rem;
      width: calc(100% + 1rem);
      height: calc(100% + 1rem);
      border-radius: inherit;
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: inherit;
    }
    .image-label {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 4px 8px;
      font-size: 12px;
      color: #fff;
      background: rgba(0, 0, 0, 0.55);
    }
    .box-label {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      padding: 10px 14px;
      border-radius: inherit;
      color: #fff;
      font-size: 13px;
      text-align: center;
      box-sizing: border-box;
    }
  `,
})
export class BoxNodeComponent implements NgDiagramNodeTemplate<BoxNodeData> {
  readonly node = input.required<NgNode<BoxNodeData>>();

  protected readonly data = computed(() => this.node().data);
  protected readonly imageUrl = computed(() => {
    const link = this.data().link;
    return link?.kind === 'image' ? attachmentUrl(link.attachmentId) : null;
  });
}
