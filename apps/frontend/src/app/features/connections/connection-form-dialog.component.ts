import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
  ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CONNECTION_TYPE_LABELS,
  CONNECTION_TYPES,
  ConnectionDto,
  ConnectionType,
  DeviceDto,
} from '@smart-home-inventory/shared';
import { mdiSwapHorizontal } from '@mdi/js';
import { ConnectionsApi } from '../../core/api/api.services';
import { ToastService } from '../../core/toast/toast.service';
import { DevicePickerComponent } from '../../shared/ui/device-picker.component';
import { IconComponent } from '../../shared/ui/icon.component';

/**
 * Create a connection. `fixedDevice` (when opened from a device page) becomes
 * one endpoint; direction is chosen with the from/to toggle. `fixedPair`
 * (opened from a diagram edge whose two ends are both device-linked) fixes
 * both ends and their direction outright — nothing left to pick.
 */
@Component({
  selector: 'app-connection-form-dialog',
  imports: [FormsModule, DevicePickerComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg (cancel)="closed.emit()">
      <h3>New connection</h3>
      <form (ngSubmit)="save()">
        <label class="field">
          <span>Type *</span>
          <select class="text" name="type" [(ngModel)]="type">
            @for (t of types; track t) {
              <option [value]="t">{{ typeLabels[t] }}</option>
            }
          </select>
        </label>

        @if (effectivePair(); as pair) {
          <div class="field">
            <span>Connection</span>
            <div class="pair-row">
              <div class="value">{{ pair.from.name }} → {{ pair.to.name }}</div>
              <button type="button" class="btn icon-only" title="Turn around" (click)="swapped.set(!swapped())">
                <app-icon [path]="icons.swap" [size]="16" />
              </button>
            </div>
          </div>
        } @else if (fixedDevice(); as fixed) {
          <label class="field">
            <span>Direction</span>
            <select class="text" name="direction" [(ngModel)]="fixedIsSource">
              <option [ngValue]="true">{{ fixed.name }} → other device</option>
              <option [ngValue]="false">other device → {{ fixed.name }}</option>
            </select>
          </label>
          <div class="field">
            <span>Other device *</span>
            <app-device-picker
              [exclude]="[fixed.id]"
              [currentAreaId]="fixed.areaId"
              (selected)="otherDevice.set($event)"
            />
          </div>
        } @else {
          <div class="field">
            <span>From device (upstream) *</span>
            <app-device-picker
              [exclude]="otherDevice() ? [otherDevice()!.id] : []"
              [currentAreaId]="otherDevice()?.areaId ?? null"
              (selected)="sourceDevice.set($event)"
            />
          </div>
          <div class="field">
            <span>To device *</span>
            <app-device-picker
              [exclude]="sourceDevice() ? [sourceDevice()!.id] : []"
              [currentAreaId]="sourceDevice()?.areaId ?? null"
              (selected)="otherDevice.set($event)"
            />
          </div>
        }

        <label class="field">
          <span>Label</span>
          <input
            class="text"
            name="label"
            [(ngModel)]="label"
            placeholder="e.g. L2 / F7, Port 12, OnOff cluster"
          />
        </label>
        <label class="field">
          <span>Notes</span>
          <textarea class="text" name="notes" rows="2" [(ngModel)]="notes"></textarea>
        </label>

        <div class="actions">
          <button type="button" class="btn secondary" (click)="closed.emit()">
            Cancel
          </button>
          <button type="submit" class="btn" [disabled]="!canSave() || saving()">
            Create
          </button>
        </div>
      </form>
    </dialog>
  `,
  styles: `
    .value {
      font-size: 13px;
      color: var(--primary-text-color);
    }
    .pair-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
  `,
})
export class ConnectionFormDialogComponent {
  private readonly api = inject(ConnectionsApi);
  private readonly toast = inject(ToastService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  readonly open = input(false);
  readonly fixedDevice = input<DeviceDto | null>(null);
  readonly fixedPair = input<{ from: DeviceDto; to: DeviceDto } | null>(null);
  /** Pre-fills the label, e.g. with the diagram edge/wire's own label. */
  readonly initialLabel = input('');
  readonly closed = output<void>();
  readonly saved = output<ConnectionDto>();

  protected readonly types = CONNECTION_TYPES;
  protected readonly typeLabels = CONNECTION_TYPE_LABELS;
  protected readonly icons = { swap: mdiSwapHorizontal };
  protected type: ConnectionType = 'mains_230v';
  protected fixedIsSource = false;
  protected label = '';
  protected notes = '';
  protected readonly sourceDevice = signal<DeviceDto | null>(null);
  protected readonly otherDevice = signal<DeviceDto | null>(null);
  protected readonly saving = signal(false);
  /** Only meaningful when fixedPair() is set — lets a fixed pair's direction
   *  be turned around, since the diagram edge it came from might be drawn
   *  the opposite way from the real upstream/downstream relationship. */
  protected readonly swapped = signal(false);

  protected readonly effectivePair = computed(() => {
    const pair = this.fixedPair();
    if (!pair) return null;
    return this.swapped() ? { from: pair.to, to: pair.from } : pair;
  });

  constructor() {
    effect(() => {
      const el = this.dlg().nativeElement;
      if (this.open()) {
        this.type = 'mains_230v';
        this.fixedIsSource = false;
        this.label = this.initialLabel();
        this.notes = '';
        this.sourceDevice.set(null);
        this.otherDevice.set(null);
        this.swapped.set(false);
        if (!el.open) el.showModal();
      } else if (el.open) {
        el.close();
      }
    });
  }

  protected canSave(): boolean {
    if (this.fixedPair()) return true;
    if (this.fixedDevice()) return this.otherDevice() !== null;
    return this.sourceDevice() !== null && this.otherDevice() !== null;
  }

  protected save(): void {
    let fromDeviceId: string;
    let toDeviceId: string;
    const pair = this.effectivePair();
    const fixed = this.fixedDevice();
    const other = this.otherDevice();
    if (pair) {
      fromDeviceId = pair.from.id;
      toDeviceId = pair.to.id;
    } else if (fixed) {
      if (!other) return;
      fromDeviceId = this.fixedIsSource ? fixed.id : other.id;
      toDeviceId = this.fixedIsSource ? other.id : fixed.id;
    } else {
      const source = this.sourceDevice();
      if (!source || !other) return;
      fromDeviceId = source.id;
      toDeviceId = other.id;
    }
    this.saving.set(true);
    this.api
      .create({
        type: this.type,
        fromDeviceId,
        toDeviceId,
        label: this.label.trim() || null,
        notes: this.notes.trim() || null,
      })
      .subscribe({
        next: (connection) => {
          this.saving.set(false);
          this.toast.success('Connection created');
          this.saved.emit(connection);
        },
        error: () => this.saving.set(false),
      });
  }
}
