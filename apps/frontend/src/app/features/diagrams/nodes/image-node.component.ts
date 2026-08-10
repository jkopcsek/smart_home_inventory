import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Node as NgNode, NgDiagramNodeResizeAdornmentComponent, NgDiagramNodeTemplate } from 'ng-diagram';
import { mdiImagePlus, mdiLinkVariant } from '@mdi/js';
import { ImageNodeData } from '@smart-home-inventory/shared';
import { attachmentUrl } from '../../../core/api/api.services';
import { IconComponent } from '../../../shared/ui/icon.component';

/**
 * The "Image" shape: a freely draggable/resizable photo, unlike the locked
 * full-bleed 'background-image' shape it's otherwise modeled on. The photo
 * itself lives in its own `imageAttachmentId` field rather than the generic
 * `link` field boxes use — set/cleared from the properties panel's dedicated
 * "Image" control — so this node can ALSO link to a real Area/Device/Diagram
 * /Connection via `link` without that conflicting with what photo it shows.
 * No color/border/icon — purely a picture with a caption underneath.
 */
@Component({
  selector: 'app-image-node',
  imports: [NgDiagramNodeResizeAdornmentComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-diagram-node-resize-adornment>
      <div class="image-node" [class.selected]="node().selected">
        <div class="photo">
          @if (imageUrl(); as url) {
            <img [src]="url" [alt]="data().label || 'Image'" crossorigin="anonymous" draggable="false" />
          } @else {
            <div class="empty-state">
              <app-icon [path]="icons.image" [size]="26" />
              <span>No image</span>
            </div>
          }
          @if (data().link) {
            <div class="link-badge" title="Linked to a real item">
              <app-icon [path]="icons.link" [size]="12" />
            </div>
          }
        </div>
        @if (data().label) {
          <div class="caption">{{ data().label }}</div>
        }
      </div>
    </ng-diagram-node-resize-adornment>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .image-node {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      border-radius: 6px;
      overflow: hidden;
    }
    .image-node.selected {
      box-shadow: 0 0 0 3px var(--accent-color);
    }
    .photo {
      position: relative;
      flex: 1 1 auto;
      min-height: 0;
      background: var(--secondary-background-color);
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      /* Browsers make <img> natively draggable-as-a-file, which fights
         ng-diagram's own pointer-based node dragging — starting a drag from
         on top of the photo would try to drag the image out instead of
         moving the node. draggable="false" isn't enough alone in Safari. */
      -webkit-user-drag: none;
      user-drag: none;
    }
    .empty-state {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 12px;
      color: var(--secondary-text-color);
      border: 2px dashed var(--divider-color);
      border-radius: inherit;
      box-sizing: border-box;
    }
    .caption {
      flex: 0 0 auto;
      padding: 4px 8px;
      font-size: 12px;
      text-align: center;
      color: var(--primary-text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .link-badge {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.5);
      color: #fff;
      pointer-events: none;
    }
  `,
})
export class ImageNodeComponent implements NgDiagramNodeTemplate<ImageNodeData> {
  readonly node = input.required<NgNode<ImageNodeData>>();
  protected readonly icons = { image: mdiImagePlus, link: mdiLinkVariant };

  protected readonly data = computed(() => this.node().data);
  protected readonly imageUrl = computed(() => {
    const id = this.data().imageAttachmentId;
    return id ? attachmentUrl(id) : null;
  });
}
