import { ChangeDetectionStrategy, Component, computed, ElementRef, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { ConnectionDto, ConnectionType, DeviceDto } from '@smart-home-inventory/shared';
import { ConnectionTypesStore } from '../../../core/connection-types/connection-types.store';
import { IconComponent } from '../../../shared/ui/icon.component';
import { mdiPlus, mdiTransitConnectionVariant } from '@mdi/js';
import { ConnectionFormDialogComponent } from '../../connections/connection-form-dialog.component';

/**
 * Optionally links an edge/node to a real Connection between two devices.
 * Connections sharing a device with the thing being linked float to the top
 * (most likely to be a real hit); "Create new" is always the first row —
 * see one, know it's missing, create it — rather than a separate button.
 */
@Component({
  selector: 'app-connection-picker-dialog',
  imports: [IconComponent, ConnectionFormDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg (cancel)="closed.emit()">
      <h3>Link to a connection</h3>
      <ul class="list">
        <li>
          <button type="button" class="create-new" (click)="formOpen.set(true)">
            <app-icon [path]="icons.plus" [size]="16" />
            <span>Create new connection</span>
          </button>
        </li>
        @for (c of sortedConnections(); track c.id) {
          <li>
            <button type="button" (click)="picked.emit(c)">
              <span>{{ c.fromDeviceName }} → {{ c.toDeviceName }}</span>
              <span class="muted">{{ connectionTypes.label(c.type) }}</span>
            </button>
          </li>
        }
      </ul>
      <div class="actions">
        <button type="button" class="btn secondary" (click)="closed.emit()">Cancel</button>
      </div>
    </dialog>

    <app-connection-form-dialog
      [open]="formOpen()"
      [fixedDevice]="contextDevice()"
      [fixedPair]="formFixedPair()"
      [initialLabel]="contextLabel()"
      [initialType]="contextType()"
      (closed)="formOpen.set(false)"
      (saved)="onCreated($event)"
    />
  `,
  styles: `
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: min(65vh, 480px);
      overflow: auto;
    }
    .list button {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      width: 100%;
      text-align: left;
      font: inherit;
      background: none;
      border: none;
      border-radius: 6px;
      padding: 8px 10px;
      cursor: pointer;
      color: inherit;
    }
    .list button:hover {
      background: var(--hover-color);
    }
    .create-new {
      justify-content: flex-start !important;
      color: var(--primary-color);
      font-weight: 500;
      border-bottom: 1px solid var(--divider-color) !important;
      border-radius: 0 !important;
      margin-bottom: 4px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
  `,
})
export class ConnectionPickerDialogComponent {
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  readonly open = input(false);
  readonly connections = input<ConnectionDto[]>([]);
  /** Device id(s) relevant to whatever's being linked (the edge's two
   *  device-linked endpoints, or a node's own linked device, if any) — used
   *  purely to sort likely matches to the top, not to filter anything out. */
  readonly contextDeviceIds = input<string[]>([]);
  /** The node's own linked device, when linking a node (not an edge) —
   *  pre-fills "Create new connection" the same way opening it from a
   *  device page would. */
  readonly contextDevice = input<DeviceDto | null>(null);
  /** Both ends of the edge being linked, when both are device-linked nodes —
   *  pre-fills "Create new connection" outright, direction and all. */
  readonly contextDevicePair = input<[DeviceDto, DeviceDto] | null>(null);
  /** The edge/wire's own label, if any — pre-fills "Create new connection"'s label. */
  readonly contextLabel = input('');
  /** The edge/wire's own type, if it maps to a real Connection type — pre-fills
   *  "Create new connection"'s type. */
  readonly contextType = input<ConnectionType | ''>('');
  readonly closed = output<void>();
  readonly picked = output<ConnectionDto>();

  protected readonly connectionTypes = inject(ConnectionTypesStore);
  protected readonly formOpen = signal(false);
  protected readonly icons = { connection: mdiTransitConnectionVariant, plus: mdiPlus };

  protected readonly sortedConnections = computed(() => {
    const ids = this.contextDeviceIds();
    const list = this.connections();
    if (ids.length === 0) return list;
    return [...list].sort((a, b) => this.matchScore(b, ids) - this.matchScore(a, ids));
  });

  protected readonly formFixedPair = computed(() => {
    const pair = this.contextDevicePair();
    return pair ? { from: pair[0], to: pair[1] } : null;
  });

  constructor() {
    effect(() => {
      const el = this.dlg().nativeElement;
      if (this.open()) {
        if (!el.open) el.showModal();
      } else if (el.open) {
        el.close();
      }
    });
  }

  protected onCreated(connection: ConnectionDto): void {
    this.formOpen.set(false);
    this.picked.emit(connection);
  }

  private matchScore(c: ConnectionDto, ids: string[]): number {
    const bothEnds = ids.length === 2;
    if (
      bothEnds &&
      ((c.fromDeviceId === ids[0] && c.toDeviceId === ids[1]) ||
        (c.fromDeviceId === ids[1] && c.toDeviceId === ids[0]))
    ) {
      return 2;
    }
    if (ids.includes(c.fromDeviceId) || ids.includes(c.toDeviceId)) return 1;
    return 0;
  }
}
