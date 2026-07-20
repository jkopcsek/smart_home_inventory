import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { DiagramDto } from '@smart-home-inventory/shared';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { mdiChartTimelineVariant } from '@mdi/js';

/** Picks a sibling Diagram to jump to from a diagram-link node. */
@Component({
  selector: 'app-diagram-link-picker-dialog',
  imports: [EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg (cancel)="closed.emit()">
      <h3>Link to another diagram</h3>
      @if (diagrams().length > 0) {
        <ul class="list">
          @for (d of diagrams(); track d.id) {
            <li>
              <button type="button" (click)="picked.emit(d)">{{ d.title }}</button>
            </li>
          }
        </ul>
      } @else {
        <app-empty-state [icon]="icons.diagram" message="No other diagrams here yet" />
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
export class DiagramLinkPickerDialogComponent {
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  readonly open = input(false);
  readonly diagrams = input<DiagramDto[]>([]);
  readonly closed = output<void>();
  readonly picked = output<DiagramDto>();

  protected readonly icons = { diagram: mdiChartTimelineVariant };

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
