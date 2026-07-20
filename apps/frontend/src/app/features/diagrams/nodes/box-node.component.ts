import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Node as NgNode, NgDiagramBaseNodeTemplateComponent, NgDiagramNodeTemplate } from 'ng-diagram';
import { BoxNodeData } from '@smart-home-inventory/shared';
import { attachmentUrl } from '../../../core/api/api.services';

/**
 * The "Box" shape. With no link (or a device/diagram link) it's a plain
 * labeled, filled box; linked to an image, it renders that photo instead —
 * the same box, different content. Wrapped in ng-diagram-base-node-template
 * so it keeps the default node's selection styling, resize handles and ports.
 */
@Component({
  selector: 'app-box-node',
  imports: [NgDiagramBaseNodeTemplateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-diagram-base-node-template [node]="node()">
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
    </ng-diagram-base-node-template>
  `,
  styles: `
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
      padding: 10px 14px;
      border-radius: inherit;
      color: #fff;
      font-size: 13px;
      text-align: center;
      height: 100%;
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
