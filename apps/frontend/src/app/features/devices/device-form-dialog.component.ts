import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AreaDto,
  DEVICE_CATEGORIES,
  DeviceCategory,
  DeviceDto,
} from '@smart-home-inventory/shared';
import { AreasApi, DevicesApi } from '../../core/api/api.services';
import { ToastService } from '../../core/toast/toast.service';

/**
 * Quick device creation for contexts that need a device to exist right now
 * (e.g. linking a diagram node) rather than sending the user to the full
 * device form and back. Mirrors AreaFormDialogComponent's pattern.
 */
@Component({
  selector: 'app-device-form-dialog',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg (cancel)="closed.emit()">
      <h3>New device</h3>
      <form (ngSubmit)="save()">
        <label class="field">
          <span>Name *</span>
          <input class="text" name="name" [(ngModel)]="name" required />
        </label>
        <label class="field">
          <span>Area</span>
          <select class="text" name="areaId" [(ngModel)]="areaId">
            <option [ngValue]="null">—</option>
            @for (area of areas(); track area.id) {
              <option [value]="area.id">{{ area.name }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span>Category</span>
          <select class="text" name="category" [(ngModel)]="category">
            <option [ngValue]="null">—</option>
            @for (cat of categories; track cat) {
              <option [value]="cat">{{ cat }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span>Manufacturer</span>
          <input class="text" name="manufacturer" [(ngModel)]="manufacturer" />
        </label>
        <label class="field">
          <span>Model</span>
          <input class="text" name="modelName" [(ngModel)]="modelName" />
        </label>
        <div class="actions">
          <button type="button" class="btn secondary" (click)="closed.emit()">
            Cancel
          </button>
          <button type="submit" class="btn" [disabled]="!name.trim() || saving()">
            Create
          </button>
        </div>
      </form>
    </dialog>
  `,
  styles: `
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
  `,
})
export class DeviceFormDialogComponent {
  private readonly api = inject(DevicesApi);
  private readonly areasApi = inject(AreasApi);
  private readonly toast = inject(ToastService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  readonly open = input(false);
  /** Preselects the area, e.g. the diagram's own area. */
  readonly currentAreaId = input<string | null>(null);
  readonly closed = output<void>();
  readonly saved = output<DeviceDto>();

  protected readonly areas = signal<AreaDto[]>([]);
  protected readonly categories = DEVICE_CATEGORIES;
  protected readonly saving = signal(false);

  protected name = '';
  protected areaId: string | null = null;
  protected category: DeviceCategory | null = null;
  protected manufacturer = '';
  protected modelName = '';

  constructor() {
    effect(() => {
      const el = this.dlg().nativeElement;
      if (this.open()) {
        this.name = '';
        this.areaId = this.currentAreaId();
        this.category = null;
        this.manufacturer = '';
        this.modelName = '';
        this.areasApi.list().subscribe((areas) => this.areas.set(areas));
        if (!el.open) el.showModal();
      } else if (el.open) {
        el.close();
      }
    });
  }

  protected save(): void {
    if (!this.name.trim()) return;
    this.saving.set(true);
    this.api
      .create({
        name: this.name.trim(),
        status: 'installed',
        areaId: this.areaId,
        category: this.category,
        manufacturer: this.manufacturer.trim() || null,
        model: this.modelName.trim() || null,
      })
      .subscribe({
        next: (device) => {
          this.saving.set(false);
          this.toast.success('Device created');
          this.saved.emit(device);
        },
        error: () => this.saving.set(false),
      });
  }
}
