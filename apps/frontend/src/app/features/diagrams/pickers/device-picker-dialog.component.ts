import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { mdiPlus } from '@mdi/js';
import { DeviceDto } from '@smart-home-inventory/shared';
import { IconComponent } from '../../../shared/ui/icon.component';
import { DevicePickerComponent } from '../../../shared/ui/device-picker.component';
import { DeviceFormDialogComponent } from '../../devices/device-form-dialog.component';

/**
 * Links a diagram node to a real Device. "Create new" is always the first
 * row, same reasoning as ConnectionPickerDialogComponent — see one, know
 * it's missing, create it — rather than a separate button elsewhere.
 */
@Component({
  selector: 'app-device-picker-dialog',
  imports: [IconComponent, DevicePickerComponent, DeviceFormDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg class="device-picker-dialog" (cancel)="closed.emit()">
      <h3>Pick a device</h3>
      <button type="button" class="create-new" (click)="formOpen.set(true)">
        <app-icon [path]="icons.plus" [size]="16" />
        <span>Create new device</span>
      </button>
      <app-device-picker
        placeholder="Search device…"
        [currentAreaId]="currentAreaId()"
        [clearOnSelect]="true"
        (selected)="picked.emit($event)"
      />
      <div class="actions">
        <button type="button" class="btn secondary" (click)="closed.emit()">Cancel</button>
      </div>
    </dialog>

    <app-device-form-dialog
      [open]="formOpen()"
      [currentAreaId]="currentAreaId()"
      (closed)="formOpen.set(false)"
      (saved)="onCreated($event)"
    />
  `,
  styles: `
    .create-new {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      text-align: left;
      font: inherit;
      font-weight: 500;
      color: var(--primary-color);
      background: none;
      border: none;
      border-bottom: 1px solid var(--divider-color);
      border-radius: 0;
      padding: 8px 10px;
      margin: 0 0 12px;
      cursor: pointer;
    }
    .create-new:hover {
      background: var(--hover-color);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
    .device-picker-dialog {
      /* app-device-picker's results dropdown is an absolutely-positioned
         overlay, so it doesn't grow the dialog's own auto-height like the
         other pickers' in-flow lists do — reserve real room up front so a
         modal <dialog>'s forced overflow:auto (Chromium) doesn't clip it. */
      min-height: min(70vh, 480px);
      overflow: visible;
    }
  `,
})
export class DevicePickerDialogComponent {
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  readonly open = input(false);
  /** Area id whose devices should be sorted to the top of search results,
   *  and preselected when creating a new device. */
  readonly currentAreaId = input<string | null>(null);
  readonly closed = output<void>();
  readonly picked = output<DeviceDto>();

  protected readonly formOpen = signal(false);
  protected readonly icons = { plus: mdiPlus };

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

  protected onCreated(device: DeviceDto): void {
    this.formOpen.set(false);
    this.picked.emit(device);
  }
}
