import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { ConnectionDto } from '@smart-home-inventory/shared';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { mdiTransitConnectionVariant } from '@mdi/js';

/** Optionally links an edge to a real Connection between two devices. */
@Component({
  selector: 'app-connection-picker-dialog',
  imports: [EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg (cancel)="closed.emit()">
      <h3>Link to a connection</h3>
      @if (connections().length > 0) {
        <ul class="list">
          @for (c of connections(); track c.id) {
            <li>
              <button type="button" (click)="picked.emit(c)">
                <span>{{ c.fromDeviceName }} → {{ c.toDeviceName }}</span>
                <span class="muted">{{ c.type }}</span>
              </button>
            </li>
          }
        </ul>
      } @else {
        <app-empty-state [icon]="icons.connection" message="No connections here yet" />
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
      max-height: 320px;
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
  readonly closed = output<void>();
  readonly picked = output<ConnectionDto>();

  protected readonly icons = { connection: mdiTransitConnectionVariant };

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
