import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { AreaDto } from '@smart-home-inventory/shared';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { mdiFloorPlan } from '@mdi/js';

/** Picks an Area to link a diagram node to. */
@Component({
  selector: 'app-area-picker-dialog',
  imports: [EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg (cancel)="closed.emit()">
      <h3>Link to an area</h3>
      @if (areas().length > 0) {
        <ul class="list">
          @for (a of areas(); track a.id) {
            <li>
              <button type="button" (click)="picked.emit(a)">{{ a.name }}</button>
            </li>
          }
        </ul>
      } @else {
        <app-empty-state [icon]="icons.area" message="No areas yet" />
      }
      <div class="actions">
        <button type="button" class="btn secondary" (click)="closed.emit()">Cancel</button>
      </div>
    </dialog>
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
      display: block;
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
    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
  `,
})
export class AreaPickerDialogComponent {
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  readonly open = input(false);
  readonly areas = input<AreaDto[]>([]);
  readonly closed = output<void>();
  readonly picked = output<AreaDto>();

  protected readonly icons = { area: mdiFloorPlan };

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
}
