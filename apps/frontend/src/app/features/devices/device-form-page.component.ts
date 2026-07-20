import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AreaDto,
  CapabilityTypeDto,
  CreateDeviceDto,
  DEVICE_CATEGORIES,
  DEVICE_STATUSES,
  DeviceDetailDto,
} from '@smart-home-inventory/shared';
import { AreasApi, CapabilitiesApi, DevicesApi } from '../../core/api/api.services';
import { ToastService } from '../../core/toast/toast.service';

@Component({
  selector: 'app-device-form-page',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>{{ deviceId() ? 'Edit device' : 'New device' }}</h1>
    <form class="card" (ngSubmit)="save()">
      <div class="grid">
        <label class="field span2">
          <span>Name *</span>
          <input class="text" name="name" [(ngModel)]="model.name" required />
        </label>
        <label class="field">
          <span>Category</span>
          <select class="text" name="category" [(ngModel)]="model.category">
            <option [ngValue]="null">—</option>
            @for (cat of categories; track cat) {
              <option [value]="cat">{{ cat }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span>Status</span>
          <select class="text" name="status" [(ngModel)]="model.status">
            @for (status of statuses; track status) {
              <option [value]="status">{{ status }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span>Area</span>
          <select class="text" name="areaId" [(ngModel)]="model.areaId">
            <option [ngValue]="null">—</option>
            @for (area of areas(); track area.id) {
              <option [value]="area.id">{{ area.name }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span>Manufacturer</span>
          <input class="text" name="manufacturer" [(ngModel)]="model.manufacturer" />
        </label>
        <label class="field">
          <span>Model</span>
          <input class="text" name="modelName" [(ngModel)]="model.model" />
        </label>
        <label class="field">
          <span>Serial number</span>
          <input class="text" name="serialNumber" [(ngModel)]="model.serialNumber" />
        </label>
        <label class="field span2">
          <span>Product link</span>
          <input
            class="text"
            name="productUrl"
            type="url"
            placeholder="https://…"
            [(ngModel)]="model.productUrl"
          />
        </label>
        <label class="field">
          <span>Purchase date</span>
          <input class="text" name="purchaseDate" type="date" [(ngModel)]="purchaseDate" />
        </label>
        <label class="field">
          <span>Price (€)</span>
          <input
            class="text"
            name="price"
            type="number"
            step="0.01"
            min="0"
            [(ngModel)]="priceEuros"
          />
        </label>
        <label class="field">
          <span>Purchased from</span>
          <input class="text" name="purchasedFrom" [(ngModel)]="model.purchasedFrom" />
        </label>
        <label class="field span2">
          <span>Notes</span>
          <textarea class="text" name="notes" rows="4" [(ngModel)]="model.notes"></textarea>
        </label>
      </div>

      <div class="field">
        <span class="cap-label">Capabilities</span>
        <div class="chips">
          @for (cap of capabilities(); track cap.id) {
            <button
              type="button"
              class="chip"
              [class.active]="selectedCapabilities().includes(cap.key)"
              (click)="toggleCapability(cap.key)"
            >
              {{ cap.label }}
            </button>
          }
        </div>
      </div>

      <div class="actions">
        <button type="button" class="btn secondary" (click)="cancel()">Cancel</button>
        <button type="submit" class="btn" [disabled]="!model.name.trim() || saving()">
          Save
        </button>
      </div>
    </form>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 16px;
    }
    .span2 {
      grid-column: span 2;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }
    .cap-label {
      font-size: 12px;
      color: var(--secondary-text-color);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
    @media (max-width: 640px) {
      .grid {
        grid-template-columns: 1fr;
      }
      .span2 {
        grid-column: span 1;
      }
    }
  `,
})
export class DeviceFormPageComponent implements OnInit {
  private readonly devicesApi = inject(DevicesApi);
  private readonly areasApi = inject(AreasApi);
  private readonly capabilitiesApi = inject(CapabilitiesApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** Route param when editing; undefined when creating. */
  readonly deviceId = input<string | undefined>(undefined);
  /** Query param: preselect area when coming from an area page. */
  readonly areaId = input<string | undefined>(undefined);

  protected readonly areas = signal<AreaDto[]>([]);
  protected readonly capabilities = signal<CapabilityTypeDto[]>([]);
  protected readonly selectedCapabilities = signal<string[]>([]);
  protected readonly saving = signal(false);
  protected readonly categories = DEVICE_CATEGORIES;
  protected readonly statuses = DEVICE_STATUSES;

  private originalCapabilities: string[] = [];

  protected model: CreateDeviceDto = {
    name: '',
    status: 'installed',
    category: null,
    areaId: null,
    manufacturer: null,
    model: null,
    serialNumber: null,
    productUrl: null,
    purchasedFrom: null,
    notes: null,
  };
  protected purchaseDate = '';
  protected priceEuros: number | null = null;

  ngOnInit(): void {
    this.areasApi.list().subscribe((areas) => this.areas.set(areas));
    this.capabilitiesApi.listTypes().subscribe((caps) => this.capabilities.set(caps));
    const id = this.deviceId();
    if (id) {
      this.devicesApi.get(id).subscribe((device) => this.populate(device));
    } else if (this.areaId()) {
      this.model.areaId = this.areaId();
    }
  }

  private populate(device: DeviceDetailDto): void {
    this.model = {
      name: device.name,
      status: device.status,
      category: device.category,
      areaId: device.areaId,
      manufacturer: device.manufacturer,
      model: device.model,
      serialNumber: device.serialNumber,
      productUrl: device.productUrl,
      purchasedFrom: device.purchasedFrom,
      notes: device.notes,
    };
    this.purchaseDate = device.purchaseDate?.slice(0, 10) ?? '';
    this.priceEuros =
      device.purchasePriceCents !== null ? device.purchasePriceCents / 100 : null;
    const keys = device.capabilities.map((c) => c.key);
    this.selectedCapabilities.set(keys);
    this.originalCapabilities = keys;
  }

  protected toggleCapability(key: string): void {
    this.selectedCapabilities.update((keys) =>
      keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]
    );
  }

  protected save(): void {
    if (!this.model.name.trim()) return;
    this.saving.set(true);
    const dto: CreateDeviceDto = {
      ...this.model,
      name: this.model.name.trim(),
      productUrl: this.model.productUrl?.trim() || null,
      purchaseDate: this.purchaseDate
        ? new Date(this.purchaseDate + 'T00:00:00Z').toISOString()
        : null,
      purchasePriceCents:
        this.priceEuros !== null && this.priceEuros !== undefined
          ? Math.round(this.priceEuros * 100)
          : null,
    };
    const id = this.deviceId();
    const req = id ? this.devicesApi.update(id, dto) : this.devicesApi.create(dto);
    req.subscribe({
      next: async (device) => {
        await this.syncCapabilities(device.id);
        this.saving.set(false);
        this.toast.success(id ? 'Device updated' : 'Device created');
        this.router.navigate(['/devices', device.id]);
      },
      error: () => this.saving.set(false),
    });
  }

  private async syncCapabilities(deviceId: string): Promise<void> {
    const wanted = this.selectedCapabilities();
    const added = wanted.filter((k) => !this.originalCapabilities.includes(k));
    const removed = this.originalCapabilities.filter((k) => !wanted.includes(k));
    await Promise.all([
      ...added.map((key) =>
        this.capabilitiesApi.setForDevice(deviceId, key).toPromise()
      ),
      ...removed.map((key) =>
        this.capabilitiesApi.removeForDevice(deviceId, key).toPromise()
      ),
    ]);
  }

  protected cancel(): void {
    const id = this.deviceId();
    this.router.navigate(id ? ['/devices', id] : ['/devices']);
  }
}
