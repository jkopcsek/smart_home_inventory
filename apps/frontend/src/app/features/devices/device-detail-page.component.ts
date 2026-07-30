import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import {
  ConnectionDto,
  DeviceDetailDto,
  DiagramDto,
  HaCapabilitySuggestionDto,
  ZigbeeCatalogMatchDto,
} from '@smart-home-inventory/shared';
import {
  mdiArrowLeftThin,
  mdiArrowRightThin,
  mdiClose,
  mdiDelete,
  mdiDevices,
  mdiOpenInNew,
  mdiPencil,
  mdiPlus,
} from '@mdi/js';
import {
  attachmentUrl,
  AttachmentsApi,
  CapabilitiesApi,
  ConnectionsApi,
  DevicesApi,
  DiagramsApi,
  HaApi,
  ZigbeeCatalogApi,
} from '../../core/api/api.services';
import { ConfirmService } from '../../core/confirm/confirm.service';
import { ToastService } from '../../core/toast/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { OwnerItemsComponent } from '../attachments/owner-items.component';
import { ConnectionFormDialogComponent } from '../connections/connection-form-dialog.component';

@Component({
  selector: 'app-device-detail-page',
  imports: [
    RouterLink,
    IconComponent,
    OwnerItemsComponent,
    ConnectionFormDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (device(); as d) {
      <div class="header">
        <div class="title-block">
          @if (d.primaryImageId) {
            <img class="hero" [src]="imageUrl(d.primaryImageId)" alt="" />
          } @else {
            <div class="hero placeholder">
              <app-icon [path]="icons.devices" [size]="32" />
            </div>
          }
          <div>
            <h1>{{ d.name }}</h1>
            <span class="muted">
              {{ d.manufacturer }} {{ d.model }}
              @if (d.areaName) {
                · <a [routerLink]="['/areas', d.areaId]">{{ d.areaName }}</a>
              }
              · {{ d.status }}
              @if (d.haOrphaned) {
                · <span class="warn">no longer in HA</span>
              }
            </span>
            <div class="chips">
              @for (cap of d.capabilities; track cap.key) {
                <span class="chip" [title]="cap.notes ?? ''">{{ cap.label }}</span>
              }
            </div>
          </div>
        </div>
        <div class="header-actions">
          <a class="btn secondary" [routerLink]="['/devices', d.id, 'edit']">
            <app-icon [path]="icons.pencil" [size]="18" /> Edit
          </a>
          <button class="btn danger" (click)="removeDevice()">
            <app-icon [path]="icons.delete" [size]="18" /> Delete
          </button>
        </div>
      </div>

      @if (zigbeeMatch(); as match) {
        @if (zigbeeSuggestionVisible()) {
          <div class="card section zigbee-suggestion">
            <div class="section-head">
              <h3>Suggested from Zigbee2MQTT</h3>
              <button class="btn icon-only" title="Dismiss" (click)="zigbeeMatch.set(null)">
                <app-icon [path]="icons.close" [size]="16" />
              </button>
            </div>
            <div class="zigbee-row">
              @if (match.imageUrl && !d.primaryImageId) {
                <img class="zigbee-thumb" [src]="match.imageUrl" alt="" />
              }
              <div class="zigbee-info">
                <div>{{ match.vendor }} {{ match.model }} — {{ match.description }}</div>
                <div class="chips">
                  @if (match.imageUrl && !d.primaryImageId) {
                    <button
                      class="btn secondary"
                      [disabled]="applyingImage()"
                      (click)="useZigbeeImage(d.id, match)"
                    >
                      Use as primary image
                    </button>
                  }
                  @if (match.suggestedCapabilities.length > 2) {
                    <button
                      class="btn secondary"
                      (click)="applyAllSuggested(d.id, match.suggestedCapabilities)"
                    >
                      Apply all
                    </button>
                  }
                  @for (cap of match.suggestedCapabilities; track cap.key) {
                    @if (hasCapability(d, cap.key)) {
                      <span class="chip muted">{{ cap.label }} ✓</span>
                    } @else {
                      <button class="chip chip-button" (click)="addSuggestedCapability(d.id, cap)">
                        + {{ cap.label }}
                      </button>
                    }
                  }
                </div>
              </div>
            </div>
          </div>
        }
      }

      @if (haSuggestion(); as suggestion) {
        @if (haSuggestionVisible()) {
          <div class="card section zigbee-suggestion">
            <div class="section-head">
              <h3>Suggested from Home Assistant</h3>
              <button class="btn icon-only" title="Dismiss" (click)="haSuggestion.set(null)">
                <app-icon [path]="icons.close" [size]="16" />
              </button>
            </div>
            <div class="chips">
              @if (suggestion.suggestedCapabilities.length > 2) {
                <button
                  class="btn secondary"
                  (click)="applyAllSuggested(d.id, suggestion.suggestedCapabilities)"
                >
                  Apply all
                </button>
              }
              @for (cap of suggestion.suggestedCapabilities; track cap.key) {
                @if (hasCapability(d, cap.key)) {
                  <span class="chip muted">{{ cap.label }} ✓</span>
                } @else {
                  <button class="chip chip-button" (click)="addSuggestedCapability(d.id, cap)">
                    + {{ cap.label }}
                  </button>
                }
              }
            </div>
          </div>
        }
      }

      <div class="card section">
        <h3>Details</h3>
        <dl>
          @if (d.serialNumber) {
            <dt>Serial number</dt>
            <dd>{{ d.serialNumber }}</dd>
          }
          @if (d.category) {
            <dt>Category</dt>
            <dd>{{ d.category }}</dd>
          }
          @if (d.purchaseDate) {
            <dt>Purchased</dt>
            <dd>
              {{ d.purchaseDate.slice(0, 10) }}
              @if (d.purchasePriceCents !== null) {
                for {{ (d.purchasePriceCents / 100).toFixed(2) }}
                {{ d.purchaseCurrency }}
              }
              @if (d.purchasedFrom) {
                at {{ d.purchasedFrom }}
              }
            </dd>
          }
          @if (d.productUrl) {
            <dt>Product link</dt>
            <dd>
              <a [href]="d.productUrl" target="_blank" rel="noopener">
                {{ d.productUrl }} <app-icon [path]="icons.openInNew" [size]="14" />
              </a>
            </dd>
          }
          @if (d.haDeviceId) {
            <dt>HA device</dt>
            <dd class="muted">{{ d.haDeviceId }}</dd>
          }
        </dl>
        @if (d.notes) {
          <p class="notes">{{ d.notes }}</p>
        }
      </div>

      <div class="card section">
        <div class="section-head">
          <h3>Connections ({{ d.connections.length }})</h3>
          <button class="btn secondary" (click)="connectionDialogOpen.set(true)">
            <app-icon [path]="icons.plus" [size]="18" /> Add
          </button>
        </div>
        @if (d.connections.length > 0) {
          <table class="data">
            <tbody>
              @for (conn of d.connections; track conn.id) {
                <tr>
                  <td><span class="chip">{{ conn.type }}</span></td>
                  <td>
                    @if (conn.fromDeviceId === d.id) {
                      <app-icon [path]="icons.arrowRight" [size]="16" class="muted" />
                      <a [routerLink]="['/devices', conn.toDeviceId]">
                        {{ conn.toDeviceName }}
                      </a>
                    } @else {
                      <app-icon [path]="icons.arrowLeft" [size]="16" class="muted" />
                      <a [routerLink]="['/devices', conn.fromDeviceId]">
                        {{ conn.fromDeviceName }}
                      </a>
                    }
                  </td>
                  <td class="muted">{{ conn.label }}</td>
                  <td class="row-actions">
                    <button
                      class="btn icon-only"
                      title="Delete connection"
                      (click)="removeConnection(conn)"
                    >
                      <app-icon [path]="icons.delete" [size]="18" />
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <p class="muted">
            No connections. Wire this device to a breaker, coordinator, switch…
          </p>
        }
      </div>

      <div class="card section">
        <app-owner-items
          [owner]="{ deviceId: d.id }"
          [diagrams]="diagrams()"
          [attachments]="d.attachments"
          (changed)="load()"
        />
      </div>

      <app-connection-form-dialog
        [open]="connectionDialogOpen()"
        [fixedDevice]="d"
        (closed)="connectionDialogOpen.set(false)"
        (saved)="connectionDialogOpen.set(false); load()"
      />
    }
  `,
  styles: `
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .title-block {
      display: flex;
      gap: 16px;
      align-items: center;
    }
    .hero {
      width: 84px;
      height: 84px;
      border-radius: var(--ha-card-border-radius);
      object-fit: cover;
    }
    .hero.placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--secondary-background-color);
      color: var(--secondary-text-color);
    }
    h1 {
      margin-bottom: 2px;
    }
    .chips {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      margin-top: 6px;
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
    .zigbee-row {
      display: flex;
      gap: 12px;
    }
    .zigbee-thumb {
      width: 64px;
      height: 64px;
      object-fit: contain;
      border-radius: 6px;
      background: var(--secondary-background-color);
      flex-shrink: 0;
    }
    .zigbee-info {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }
    .chip-button {
      border: none;
      cursor: pointer;
      font: inherit;
    }
    .section-head h3 {
      margin: 0;
    }
    dl {
      display: grid;
      grid-template-columns: 160px 1fr;
      gap: 4px 16px;
      margin: 0;
    }
    dt {
      color: var(--secondary-text-color);
    }
    dd {
      margin: 0;
    }
    .notes {
      white-space: pre-wrap;
      border-top: 1px solid var(--divider-color);
      padding-top: 8px;
      margin: 12px 0 0;
    }
    .warn {
      color: var(--warning-color);
    }
    .row-actions {
      text-align: right;
    }
  `,
})
export class DeviceDetailPageComponent implements OnInit {
  private readonly devicesApi = inject(DevicesApi);
  private readonly connectionsApi = inject(ConnectionsApi);
  private readonly diagramsApi = inject(DiagramsApi);
  private readonly attachmentsApi = inject(AttachmentsApi);
  private readonly capabilitiesApi = inject(CapabilitiesApi);
  private readonly zigbeeCatalogApi = inject(ZigbeeCatalogApi);
  private readonly haApi = inject(HaApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly deviceId = input.required<string>();

  protected readonly device = signal<DeviceDetailDto | null>(null);
  protected readonly diagrams = signal<DiagramDto[]>([]);
  protected readonly connectionDialogOpen = signal(false);
  protected readonly zigbeeMatch = signal<ZigbeeCatalogMatchDto | null>(null);
  protected readonly haSuggestion = signal<HaCapabilitySuggestionDto | null>(null);
  protected readonly applyingImage = signal(false);

  /** Hides the card once every suggestion is either already on the device
   *  or, for the image, moot because a primary image already exists
   *  (whether it came from this suggestion or not). */
  protected readonly zigbeeSuggestionVisible = computed(() => {
    const match = this.zigbeeMatch();
    const d = this.device();
    if (!match || !d) return false;
    const allCapsApplied = match.suggestedCapabilities.every((c) => this.hasCapability(d, c.key));
    const imageDone = !match.imageUrl || !!d.primaryImageId;
    return !(allCapsApplied && imageDone);
  });

  protected readonly haSuggestionVisible = computed(() => {
    const suggestion = this.haSuggestion();
    const d = this.device();
    if (!suggestion || !d || suggestion.suggestedCapabilities.length === 0) return false;
    return !suggestion.suggestedCapabilities.every((c) => this.hasCapability(d, c.key));
  });

  protected readonly icons = {
    pencil: mdiPencil,
    delete: mdiDelete,
    plus: mdiPlus,
    devices: mdiDevices,
    openInNew: mdiOpenInNew,
    arrowRight: mdiArrowRightThin,
    arrowLeft: mdiArrowLeftThin,
    close: mdiClose,
  };

  ngOnInit(): void {
    this.load();
  }

  protected imageUrl = (id: string) => attachmentUrl(id, true);

  protected load(): void {
    this.devicesApi.get(this.deviceId()).subscribe((device) => {
      this.device.set(device);
      this.zigbeeMatch.set(null);
      this.haSuggestion.set(null);
      if (device.model?.trim()) {
        this.zigbeeCatalogApi.match(device.model).subscribe((match) => this.zigbeeMatch.set(match));
      }
      if (device.haDeviceId) {
        this.haApi
          .capabilitySuggestions(device.id)
          .subscribe((suggestion) => this.haSuggestion.set(suggestion));
      }
    });
    this.diagramsApi.list({ deviceId: this.deviceId() }).subscribe((d) => this.diagrams.set(d));
  }

  protected hasCapability(device: DeviceDetailDto, key: string): boolean {
    return device.capabilities.some((c) => c.key === key);
  }

  protected addSuggestedCapability(deviceId: string, cap: { key: string; label: string }): void {
    this.capabilitiesApi.setForDevice(deviceId, cap.key).subscribe(() => this.load());
  }

  protected applyAllSuggested(deviceId: string, caps: Array<{ key: string; label: string }>): void {
    const device = this.device();
    const pending = caps.filter((c) => !device || !this.hasCapability(device, c.key));
    if (pending.length === 0) return;
    forkJoin(pending.map((c) => this.capabilitiesApi.setForDevice(deviceId, c.key))).subscribe(() =>
      this.load()
    );
  }

  protected useZigbeeImage(deviceId: string, match: ZigbeeCatalogMatchDto): void {
    const url = match.imageUrl;
    if (!url) return;
    this.applyingImage.set(true);
    fetch(url)
      .then((res) => res.blob())
      .then((blob) => {
        const filename = url.split('/').pop() || `${match.model}.png`;
        const file = new File([blob], filename, { type: blob.type });
        this.attachmentsApi
          .upload({ deviceId }, file, 'image', `${match.vendor} ${match.model}`)
          .subscribe({
            next: (event) => {
              if (event.type === HttpEventType.Response && event.body) {
                this.devicesApi.setPrimaryImage(deviceId, event.body.id).subscribe(() => {
                  this.applyingImage.set(false);
                  this.toast.success('Primary image set');
                  this.load();
                });
              }
            },
            error: () => this.applyingImage.set(false),
          });
      })
      .catch(() => {
        this.applyingImage.set(false);
        this.toast.error('Could not fetch the image from Zigbee2MQTT');
      });
  }

  protected async removeConnection(conn: ConnectionDto): Promise<void> {
    const confirmed = await this.confirm.ask(
      `Delete this ${conn.type} connection?`,
      { confirmLabel: 'Delete' }
    );
    if (!confirmed) return;
    this.connectionsApi.remove(conn.id).subscribe(() => this.load());
  }

  protected async removeDevice(): Promise<void> {
    const device = this.device();
    if (!device) return;
    const confirmed = await this.confirm.ask(
      `Delete device "${device.name}" including its attachments and connections?`,
      { confirmLabel: 'Delete' }
    );
    if (!confirmed) return;
    this.devicesApi.remove(device.id).subscribe(() => {
      this.toast.success('Device deleted');
      this.router.navigate(['/devices']);
    });
  }
}
