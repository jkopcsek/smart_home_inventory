import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DeviceDto } from '@smart-home-inventory/shared';
import { DevicesApi } from '../../core/api/api.services';

/** Lightweight autocomplete for picking a device. */
@Component({
  selector: 'app-device-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="picker">
      <input
        class="text"
        type="text"
        [placeholder]="placeholder()"
        [value]="query()"
        (input)="onQuery($event)"
        (focus)="search(query())"
        (blur)="onBlur()"
      />
      @if (open() && results().length > 0) {
        <ul class="results card">
          @for (device of results(); track device.id) {
            <li (mousedown)="pick(device)">
              <span>{{ device.name }}</span>
              @if (device.areaName) {
                <span class="muted">{{ device.areaName }}</span>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .picker {
      position: relative;
    }
    .results {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      z-index: 20;
      list-style: none;
      margin: 0;
      padding: 4px;
      max-height: min(60vh, 420px);
      overflow: auto;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    }
    li {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 6px;
      cursor: pointer;
    }
    li:hover {
      background: var(--hover-color);
    }
  `,
})
export class DevicePickerComponent {
  private readonly devicesApi = inject(DevicesApi);

  readonly placeholder = input('Search device…');
  /** Device ids to exclude from results (e.g. the other endpoint). */
  readonly exclude = input<string[]>([]);
  /** Area id whose devices should be sorted to the top of the results. */
  readonly currentAreaId = input<string | null>(null);
  readonly selected = output<DeviceDto>();

  protected readonly query = signal('');
  protected readonly results = signal<DeviceDto[]>([]);
  protected readonly open = signal(false);

  protected onQuery(event: Event): void {
    const q = (event.target as HTMLInputElement).value;
    this.query.set(q);
    this.search(q);
  }

  protected search(q: string): void {
    this.devicesApi.list({ q: q || undefined }).subscribe((devices) => {
      const areaId = this.currentAreaId();
      const filtered = devices.filter((d) => !this.exclude().includes(d.id));
      if (areaId) {
        filtered.sort(
          (a, b) => Number(b.areaId === areaId) - Number(a.areaId === areaId)
        );
      }
      this.results.set(filtered.slice(0, 40));
      this.open.set(true);
    });
  }

  protected onBlur(): void {
    // Delay so mousedown on a result fires first.
    setTimeout(() => this.open.set(false), 150);
  }

  protected pick(device: DeviceDto): void {
    this.query.set(device.name);
    this.open.set(false);
    this.selected.emit(device);
  }
}
