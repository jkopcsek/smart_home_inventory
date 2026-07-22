import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { ATTACHMENT_KINDS, AttachmentKind } from '@smart-home-inventory/shared';
import { AttachmentOwner, AttachmentsApi } from '../../core/api/api.services';
import { ToastService } from '../../core/toast/toast.service';
import { FileDropzoneComponent } from './file-dropzone.component';

/**
 * The upload mechanism only — pick a type, drop/select a file. Listing and
 * per-item actions (rename, delete, download) live in the unified owner-items
 * grid and the dedicated attachment view page, not here.
 */
@Component({
  selector: 'app-attachment-upload-dialog',
  imports: [FileDropzoneComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg (cancel)="uploadOpen.set(false)">
      <h3>Add attachment</h3>
      <label class="field">
        <span>Type</span>
        <select class="text kind" [value]="uploadKind()" (change)="onKindChange($event)">
          @for (kind of kinds; track kind) {
            <option [value]="kind">{{ kind }}</option>
          }
        </select>
      </label>
      <app-file-dropzone
        [progress]="uploadProgress()"
        [accept]="acceptFor(uploadKind())"
        (files)="upload($event)"
      />
      <div class="actions">
        <button type="button" class="btn secondary" (click)="uploadOpen.set(false)">Close</button>
      </div>
    </dialog>
  `,
  styles: `
    dialog {
      width: 360px;
    }
    .kind {
      width: 100%;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
  `,
})
export class AttachmentUploadDialogComponent {
  private readonly api = inject(AttachmentsApi);
  private readonly toast = inject(ToastService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  readonly owner = input.required<AttachmentOwner>();
  readonly uploaded = output<void>();

  protected readonly kinds = ATTACHMENT_KINDS;
  protected readonly uploadKind = signal<AttachmentKind>('image');
  protected readonly uploadProgress = signal<number | null>(null);
  protected readonly uploadOpen = signal(false);

  constructor() {
    effect(() => {
      const el = this.dlg().nativeElement;
      if (this.uploadOpen()) {
        if (!el.open) el.showModal();
      } else if (el.open) {
        el.close();
      }
    });
  }

  open(): void {
    this.uploadOpen.set(true);
  }

  protected onKindChange(event: Event): void {
    this.uploadKind.set((event.target as HTMLSelectElement).value as AttachmentKind);
  }

  protected acceptFor(kind: AttachmentKind): string {
    switch (kind) {
      case 'manual':
        return 'application/pdf';
      case 'image':
      case 'plan':
        return 'image/*';
      case 'invoice':
        return 'application/pdf,image/*';
      default:
        return '*/*';
    }
  }

  protected upload(files: File[]): void {
    const file = files[0];
    if (!file) return;
    this.uploadProgress.set(0);
    this.api.upload(this.owner(), file, this.uploadKind()).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadProgress.set(Math.round((100 * event.loaded) / event.total));
        }
        if (event.type === HttpEventType.Response) {
          this.uploadProgress.set(null);
          this.uploadOpen.set(false);
          this.toast.success(`Uploaded ${file.name}`);
          this.uploaded.emit();
        }
      },
      error: () => this.uploadProgress.set(null),
    });
  }
}
