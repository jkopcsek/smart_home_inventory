import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  viewChild,
  ElementRef,
} from '@angular/core';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg (cancel)="confirm.answer(false)">
      @if (confirm.current(); as req) {
        <h3>{{ req.title }}</h3>
        <p>{{ req.message }}</p>
        <div class="actions">
          <button class="btn secondary" (click)="confirm.answer(false)">Cancel</button>
          <button
            class="btn"
            [class.danger]="req.danger"
            (click)="confirm.answer(true)"
          >
            {{ req.confirmLabel }}
          </button>
        </div>
      }
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
export class ConfirmDialogComponent {
  protected readonly confirm = inject(ConfirmService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    effect(() => {
      const open = this.confirm.current() !== null;
      const el = this.dlg().nativeElement;
      if (open && !el.open) el.showModal();
      if (!open && el.open) el.close();
    });
  }
}
