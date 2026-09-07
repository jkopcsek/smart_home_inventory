import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { mdiHomeAssistant, mdiPencilOutline } from '@mdi/js';
import { EntitySource } from '@smart-home-inventory/shared';
import { IconComponent } from './icon.component';

/**
 * Flags whether a device/area/floor is HA-synced or purely local. HA-sync
 * is the expected, "boring" case for this app, so it stays plain gray;
 * a manually-created record is the mildly surprising one (it won't reflect
 * Home Assistant's state), so "Local" gets a soft, desaturated tint —
 * distinguishable at a glance without shouting.
 */
@Component({
  selector: 'app-source-badge',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="source-badge" [class.local]="source() === 'manual'">
      <app-icon [path]="icon()" [size]="11" />
      {{ label() }}
    </span>
  `,
  styles: `
    .source-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.3px;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 4px;
      line-height: 14px;
      white-space: nowrap;
      background: var(--chip-background-color);
      color: var(--secondary-text-color);
    }
    .source-badge.local {
      background: color-mix(in srgb, var(--accent-color) 16%, var(--chip-background-color));
      color: color-mix(in srgb, var(--accent-color) 55%, var(--secondary-text-color));
    }
  `,
})
export class SourceBadgeComponent {
  readonly source = input.required<EntitySource>();

  protected readonly icon = computed(() =>
    this.source() === 'ha' ? mdiHomeAssistant : mdiPencilOutline
  );
  protected readonly label = computed(() => (this.source() === 'ha' ? 'HA' : 'Local'));
}
