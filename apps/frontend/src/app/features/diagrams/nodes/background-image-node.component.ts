import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Node as NgNode, NgDiagramNodeResizeAdornmentComponent, NgDiagramNodeTemplate } from 'ng-diagram';
import { BackgroundImageNodeData } from '@smart-home-inventory/shared';
import { attachmentUrl } from '../../../core/api/api.services';

/**
 * The "Background image" shape: a full-bleed backdrop image, usually locked
 * and sent to the back of the stack. Deliberately has no ports — it's a
 * passive backdrop (e.g. a floor plan), not something wires connect to — so
 * it uses the bare resize adornment instead of ng-diagram-base-node-template
 * (which bundles default ports along with its resize handles).
 */
@Component({
  selector: 'app-background-image-node',
  imports: [NgDiagramNodeResizeAdornmentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-diagram-node-resize-adornment>
      <img
        [src]="imageUrl()"
        [alt]="data().label || 'Background image'"
        crossorigin="anonymous"
        draggable="false"
      />
    </ng-diagram-node-resize-adornment>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      /* See image-node.component.ts — <img> is natively draggable-as-a-file
         by default, which fights ng-diagram's own node dragging. */
      -webkit-user-drag: none;
      user-drag: none;
    }
  `,
})
export class BackgroundImageNodeComponent implements NgDiagramNodeTemplate<BackgroundImageNodeData> {
  readonly node = input.required<NgNode<BackgroundImageNodeData>>();

  protected readonly data = computed(() => this.node().data);
  protected readonly imageUrl = computed(() => {
    const link = this.data().link;
    return link?.kind === 'image' ? attachmentUrl(link.attachmentId) : '';
  });
}
