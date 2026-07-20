import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AreaDto,
  CapabilityTypeDto,
  DEVICE_STATUSES,
  DeviceDto,
  DeviceQueryDto,
  DeviceStatus,
} from '@smart-home-inventory/shared';
import { mdiDevices, mdiPlus } from '@mdi/js';
import {
  AreasApi,
  attachmentUrl,
  CapabilitiesApi,
  DevicesApi,
} from '../../core/api/api.services';
import { IconComponent } from '../../shared/ui/icon.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';

@Component({
  selector: 'app-device-list-page',
  imports: [RouterLink, IconComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="header">
      <h1>Devices</h1>
      <a class="btn" routerLink="/devices/new">
        <app-icon [path]="icons.plus" [size]="18" /> New device
      </a>
    </div>

    <div class="filters card">
      <input
        class="text search"
        type="search"
        placeholder="Search name, manufacturer, model, serial…"
        [value]="query().q ?? ''"
        (input)="setFilter('q', $any($event.target).value)"
      />
      <select class="text" [value]="query().areaId ?? ''" (change)="setFilter('areaId', $any($event.target).value)">
        <option value="">All areas</option>
        @for (area of areas(); track area.id) {
          <option [value]="area.id">{{ area.name }}</option>
        }
      </select>
      <select class="text" [value]="query().status ?? ''" (change)="setFilter('status', $any($event.target).value)">
        <option value="">Any status</option>
        @for (status of statuses; track status) {
          <option [value]="status">{{ status }}</option>
        }
      </select>
      <div class="chips">
        @for (cap of capabilities(); track cap.id) {
          <button
            class="chip"
            [class.active]="query().capability === cap.key"
            (click)="toggleCapability(cap.key)"
          >
            {{ cap.label }}
          </button>
        }
      </div>
    </div>

    @if (devices().length > 0) {
      <table class="data card devices">
        <thead>
          <tr>
            <th></th>
            <th>Name</th>
            <th>Area</th>
            <th>Model</th>
            <th>Capabilities</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          @for (device of devices(); track device.id) {
            <tr class="clickable" (click)="open(device)">
              <td class="thumb-cell">
                @if (device.primaryImageId) {
                  <img class="thumb" [src]="thumbUrl(device.primaryImageId)" alt="" />
                } @else {
                  <app-icon [path]="icons.devices" [size]="22" class="muted" />
                }
              </td>
              <td>
                {{ device.name }}
                @if (device.haOrphaned) {
                  <span class="warn" title="No longer in Home Assistant">⚠</span>
                }
              </td>
              <td class="muted">{{ device.areaName ?? '—' }}</td>
              <td class="muted">{{ device.manufacturer }} {{ device.model }}</td>
              <td>
                @for (key of device.capabilityKeys; track key) {
                  <span class="chip">{{ key }}</span>
                }
              </td>
              <td class="muted">{{ device.status }}</td>
            </tr>
          }
        </tbody>
      </table>
    } @else if (loaded()) {
      <app-empty-state [icon]="icons.devices" message="No devices match" />
    }
  `,
  styles: `
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .header h1 {
      margin: 0;
    }
    .filters {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      margin-bottom: 16px;
      padding: 12px 16px;
    }
    .search {
      flex: 1;
      min-width: 200px;
    }
    .filters select {
      width: auto;
    }
    .chips {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      width: 100%;
    }
    .devices {
      padding: 0;
    }
    .thumb-cell {
      width: 44px;
    }
    .thumb {
      width: 36px;
      height: 36px;
      object-fit: cover;
      border-radius: 6px;
      display: block;
    }
    .warn {
      color: var(--warning-color);
    }
    td .chip {
      margin-right: 4px;
    }
  `,
})
export class DeviceListPageComponent implements OnInit {
  private readonly devicesApi = inject(DevicesApi);
  private readonly areasApi = inject(AreasApi);
  private readonly capabilitiesApi = inject(CapabilitiesApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly devices = signal<DeviceDto[]>([]);
  protected readonly areas = signal<AreaDto[]>([]);
  protected readonly capabilities = signal<CapabilityTypeDto[]>([]);
  protected readonly query = signal<DeviceQueryDto>({});
  protected readonly loaded = signal(false);
  protected readonly statuses = DEVICE_STATUSES;
  protected readonly icons = { plus: mdiPlus, devices: mdiDevices };

  protected thumbUrl = (id: string) => attachmentUrl(id, true);

  ngOnInit(): void {
    this.areasApi.list().subscribe((areas) => this.areas.set(areas));
    this.capabilitiesApi.listTypes().subscribe((caps) => this.capabilities.set(caps));
    // Filters live in query params so list state survives back-navigation.
    this.route.queryParamMap.subscribe((params) => {
      this.query.set({
        q: params.get('q') ?? undefined,
        areaId: params.get('areaId') ?? undefined,
        status: (params.get('status') as DeviceStatus | null) ?? undefined,
        capability: params.get('capability') ?? undefined,
      });
      this.load();
    });
  }

  protected load(): void {
    this.devicesApi.list(this.query()).subscribe((devices) => {
      this.devices.set(devices);
      this.loaded.set(true);
    });
  }

  protected setFilter(key: keyof DeviceQueryDto, value: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [key]: value || null },
      queryParamsHandling: 'merge',
    });
  }

  protected toggleCapability(key: string): void {
    this.setFilter('capability', this.query().capability === key ? '' : key);
  }

  protected open(device: DeviceDto): void {
    this.router.navigate(['/devices', device.id]);
  }
}
