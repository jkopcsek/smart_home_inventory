import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { mdiDevices } from '@mdi/js';
import { attachmentUrl } from '../../core/api/api.services';
import { IconComponent } from './icon.component';

/**
 * A device's primary image, or a fallback icon, in a fixed-size box — so a
 * row with a photo and a row without one line up instead of the icon
 * looking smaller/floating compared to a filled thumbnail. Images are
 * `object-fit: contain` (letterboxed) rather than `cover` so an odd aspect
 * ratio doesn't get cropped.
 */
@Component({
  selector: 'app-device-thumb',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="device-thumb" [style.width.px]="size()" [style.height.px]="size()">
      @if (imageId(); as id) {
        <img [src]="thumbUrl(id)" alt="" />
      } @else {
        <app-icon [path]="icons.devices" [size]="iconSize()" />
      }
    </span>
  `,
  styles: `
    .device-thumb {
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      background: var(--secondary-background-color);
      color: var(--secondary-text-color);
      overflow: hidden;
      flex-shrink: 0;
    }
    .device-thumb img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
  `,
})
export class DeviceThumbComponent {
  readonly imageId = input<string | null>(null);
  readonly size = input(36);

  protected readonly iconSize = computed(() => Math.round(this.size() * 0.6));
  protected readonly icons = { devices: mdiDevices };
  protected thumbUrl = (id: string) => attachmentUrl(id, true);
}
