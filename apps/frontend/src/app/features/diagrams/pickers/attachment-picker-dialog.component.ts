import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { AttachmentDto } from '@smart-home-inventory/shared';
import { attachmentUrl } from '../../../core/api/api.services';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { mdiImageOffOutline } from '@mdi/js';

/** Picks an existing image Attachment to drop onto the canvas as an image node. */
@Component({
  selector: 'app-attachment-picker-dialog',
  imports: [EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg (cancel)="closed.emit()">
      <h3>Choose an image</h3>
      @if (attachments().length > 0) {
        <div class="grid">
          @for (a of attachments(); track a.id) {
            <button class="tile" type="button" (click)="pick(a)">
              <img [src]="attachmentUrl(a.id, true)" [alt]="a.title || a.originalName" />
              <span class="name">{{ a.title || a.originalName }}</span>
            </button>
          }
        </div>
      } @else {
        <app-empty-state [icon]="icons.noImage" message="No images here yet — add one via Attachments first" />
      }
      <div class="actions">
        <button type="button" class="btn secondary" (click)="closed.emit()">Cancel</button>
      </div>
    </dialog>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 10px;
      max-height: min(65vh, 480px);
      overflow: auto;
    }
    .tile {
      display: flex;
      flex-direction: column;
      gap: 4px;
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      padding: 6px;
      background: none;
      cursor: pointer;
      font: inherit;
      color: inherit;
    }
    .tile:hover {
      border-color: var(--primary-color);
    }
    .tile img {
      width: 100%;
      height: 80px;
      object-fit: cover;
      border-radius: 4px;
    }
    .name {
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
  `,
})
export class AttachmentPickerDialogComponent {
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  readonly open = input(false);
  readonly attachments = input<AttachmentDto[]>([]);
  readonly closed = output<void>();
  readonly picked = output<AttachmentDto>();

  protected readonly attachmentUrl = attachmentUrl;
  protected readonly icons = { noImage: mdiImageOffOutline };

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

  protected pick(a: AttachmentDto): void {
    this.picked.emit(a);
  }
}
