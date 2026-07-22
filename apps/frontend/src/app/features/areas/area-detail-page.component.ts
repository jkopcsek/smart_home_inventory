import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AreaDto, AttachmentDto, DeviceDto, DiagramDto } from '@smart-home-inventory/shared';
import {
  mdiChevronRight,
  mdiDelete,
  mdiDevices,
  mdiPencil,
  mdiPlus,
} from '@mdi/js';
import { AreasApi, DevicesApi, DiagramsApi } from '../../core/api/api.services';
import { HttpClient } from '@angular/common/http';
import { ConfirmService } from '../../core/confirm/confirm.service';
import { ToastService } from '../../core/toast/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { OwnerItemsComponent } from '../attachments/owner-items.component';
import { AreaFormDialogComponent } from './area-form-dialog.component';

@Component({
  selector: 'app-area-detail-page',
  imports: [
    RouterLink,
    IconComponent,
    EmptyStateComponent,
    OwnerItemsComponent,
    AreaFormDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (area(); as a) {
      <div class="header">
        <div>
          <h1>{{ a.name }}</h1>
          <span class="muted">
            @if (a.floor) {
              {{ a.floor }} ·
            }
            @if (a.source === 'ha') {
              synced from Home Assistant
            } @else {
              manually created
            }
            @if (a.haOrphaned) {
              · <span class="warn">no longer in HA</span>
            }
          </span>
        </div>
        <div class="header-actions">
          <button class="btn secondary" (click)="editOpen.set(true)">
            <app-icon [path]="icons.pencil" [size]="18" /> Edit
          </button>
          <button class="btn danger" (click)="removeArea()">
            <app-icon [path]="icons.delete" [size]="18" /> Delete
          </button>
        </div>
      </div>

      @if (a.notes) {
        <div class="card section">
          <h3>Notes</h3>
          <p class="notes">{{ a.notes }}</p>
        </div>
      }

      <div class="card section">
        <div class="section-head">
          <h3>Devices ({{ devices().length }})</h3>
          <a class="btn secondary" routerLink="/devices/new" [queryParams]="{ areaId: a.id }">
            <app-icon [path]="icons.plus" [size]="18" /> Add device
          </a>
        </div>
        @if (devices().length > 0) {
          <div class="device-list">
            @for (device of devices(); track device.id) {
              <button type="button" class="device-row" (click)="openDevice(device)">
                <app-icon class="device-icon" [path]="icons.devices" [size]="24" />
                <div class="device-info">
                  <span class="device-name">{{ device.name }}</span>
                  <span class="device-sub muted">
                    {{ device.manufacturer }} {{ device.model }} · {{ device.status }}
                  </span>
                </div>
                <app-icon class="device-chevron" [path]="icons.chevron" [size]="20" />
              </button>
            }
          </div>
        } @else {
          <app-empty-state [icon]="icons.devices" message="No devices in this area" />
        }
      </div>

      <div class="card section">
        <app-owner-items
          [owner]="{ areaId: a.id }"
          [diagrams]="diagrams()"
          [attachments]="attachments()"
          (changed)="load()"
        />
      </div>

      <app-area-form-dialog
        [open]="editOpen()"
        [area]="a"
        (closed)="editOpen.set(false)"
        (saved)="editOpen.set(false); load()"
      />
    }
  `,
  styles: `
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      gap: 12px;
      flex-wrap: wrap;
    }
    .header h1 {
      margin-bottom: 2px;
    }
    .header-actions {
      display: flex;
      gap: 4px;
    }
    .section {
      margin-bottom: 16px;
    }
    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .section-head h3 {
      margin: 0;
    }
    .notes {
      white-space: pre-wrap;
      margin: 0;
    }
    .warn {
      color: var(--warning-color);
    }
    .device-list {
      display: flex;
      flex-direction: column;
    }
    .device-row {
      display: flex;
      align-items: center;
      gap: 16px;
      width: 100%;
      padding: 14px 16px;
      border: none;
      border-bottom: 1px solid var(--divider-color);
      background: none;
      font: inherit;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }
    .device-row:last-child {
      border-bottom: none;
    }
    .device-row:hover {
      background: var(--hover-color);
    }
    .device-icon {
      color: var(--secondary-text-color);
      flex-shrink: 0;
    }
    .device-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      flex: 1;
    }
    .device-name {
      font-weight: 500;
    }
    .device-sub {
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .device-chevron {
      color: var(--secondary-text-color);
      flex-shrink: 0;
    }
  `,
})
export class AreaDetailPageComponent implements OnInit {
  private readonly areasApi = inject(AreasApi);
  private readonly devicesApi = inject(DevicesApi);
  private readonly diagramsApi = inject(DiagramsApi);
  private readonly http = inject(HttpClient);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly areaId = input.required<string>();

  protected readonly area = signal<AreaDto | null>(null);
  protected readonly devices = signal<DeviceDto[]>([]);
  protected readonly diagrams = signal<DiagramDto[]>([]);
  protected readonly attachments = signal<AttachmentDto[]>([]);
  protected readonly editOpen = signal(false);

  protected readonly icons = {
    pencil: mdiPencil,
    delete: mdiDelete,
    plus: mdiPlus,
    devices: mdiDevices,
    chevron: mdiChevronRight,
  };

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    const id = this.areaId();
    this.areasApi.get(id).subscribe((area) => this.area.set(area));
    this.devicesApi.list({ areaId: id }).subscribe((d) => this.devices.set(d));
    this.diagramsApi.list({ areaId: id }).subscribe((d) => this.diagrams.set(d));
    this.loadAttachments();
  }

  protected loadAttachments(): void {
    this.http
      .get<AttachmentDto[]>(`api/areas/${this.areaId()}/attachments`)
      .subscribe((atts) => this.attachments.set(atts));
  }

  protected openDevice(device: DeviceDto): void {
    this.router.navigate(['/devices', device.id]);
  }

  protected async removeArea(): Promise<void> {
    const area = this.area();
    if (!area) return;
    const confirmed = await this.confirm.ask(
      `Delete area "${area.name}"? Devices in it are kept but unassigned; diagrams and attachments are removed.`,
      { confirmLabel: 'Delete' }
    );
    if (!confirmed) return;
    this.areasApi.remove(area.id).subscribe(() => {
      this.toast.success('Area deleted');
      this.router.navigate(['/areas']);
    });
  }
}
