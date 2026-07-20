import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import {
  ATTACHMENT_KINDS,
  AttachmentDto,
  AttachmentKind,
} from '@smart-home-inventory/shared';
import {
  mdiDelete,
  mdiDownload,
  mdiFileDocumentOutline,
  mdiFilePdfBox,
  mdiImageOutline,
  mdiPaperclip,
  mdiReceiptTextOutline,
  mdiStar,
  mdiStarOutline,
} from '@mdi/js';
import { AttachmentsApi, attachmentUrl } from '../../core/api/api.services';
import { ConfirmService } from '../../core/confirm/confirm.service';
import { ToastService } from '../../core/toast/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { FileDropzoneComponent } from './file-dropzone.component';

@Component({
  selector: 'app-attachment-gallery',
  imports: [IconComponent, EmptyStateComponent, FileDropzoneComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="upload-row">
      <select class="text kind" [value]="uploadKind()" (change)="onKindChange($event)">
        @for (kind of kinds; track kind) {
          <option [value]="kind">{{ kind }}</option>
        }
      </select>
      <app-file-dropzone
        class="grow"
        [progress]="uploadProgress()"
        [accept]="acceptFor(uploadKind())"
        (files)="upload($event)"
      />
    </div>

    @if (images().length > 0) {
      <div class="thumbs">
        @for (att of images(); track att.id) {
          <figure>
            <a [href]="inlineUrl(att.id)" target="_blank">
              <img [src]="inlineUrl(att.id)" [alt]="att.title ?? att.originalName" />
            </a>
            <figcaption>
              <span class="name" [title]="att.originalName">
                {{ att.title ?? att.originalName }}
              </span>
              @if (primaryImageId() !== undefined) {
                <button
                  class="btn icon-only"
                  [title]="att.id === primaryImageId() ? 'Primary photo' : 'Set as primary photo'"
                  (click)="togglePrimary(att)"
                >
                  <app-icon
                    [path]="att.id === primaryImageId() ? icons.star : icons.starOutline"
                    [size]="18"
                  />
                </button>
              }
              <button class="btn icon-only" title="Delete" (click)="remove(att)">
                <app-icon [path]="icons.delete" [size]="18" />
              </button>
            </figcaption>
          </figure>
        }
      </div>
    }

    @if (documents().length > 0) {
      <table class="data">
        <tbody>
          @for (att of documents(); track att.id) {
            <tr>
              <td class="icon-cell">
                <app-icon [path]="iconFor(att)" [size]="20" />
              </td>
              <td>
                <a [href]="inlineUrl(att.id)" target="_blank">
                  {{ att.title ?? att.originalName }}
                </a>
                <span class="muted size">{{ formatSize(att.sizeBytes) }}</span>
              </td>
              <td class="muted">{{ att.kind }}</td>
              <td class="actions">
                <a
                  class="btn icon-only"
                  [href]="downloadUrl(att.id)"
                  [download]="att.originalName"
                  title="Download"
                >
                  <app-icon [path]="icons.download" [size]="18" />
                </a>
                <button class="btn icon-only" title="Delete" (click)="remove(att)">
                  <app-icon [path]="icons.delete" [size]="18" />
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    }

    @if (attachments().length === 0) {
      <app-empty-state [icon]="icons.paperclip" message="No attachments yet" />
    }
  `,
  styles: `
    .upload-row {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      align-items: stretch;
    }
    .kind {
      width: 110px;
      align-self: center;
    }
    .grow {
      flex: 1;
    }
    .thumbs {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 12px;
    }
    figure {
      margin: 0;
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      overflow: hidden;
    }
    figure img {
      width: 100%;
      height: 100px;
      object-fit: cover;
      display: block;
    }
    figcaption {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 4px 6px;
      font-size: 12px;
    }
    .name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .icon-cell {
      width: 32px;
      color: var(--secondary-text-color);
    }
    .size {
      margin-left: 8px;
      font-size: 12px;
    }
    .actions {
      text-align: right;
      white-space: nowrap;
    }
  `,
})
export class AttachmentGalleryComponent {
  private readonly api = inject(AttachmentsApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly owner = input.required<{ deviceId: string } | { areaId: string }>();
  readonly attachments = input.required<AttachmentDto[]>();
  /** Pass the device's primary image id to enable the star toggle; undefined hides it. */
  readonly primaryImageId = input<string | null | undefined>(undefined);
  readonly changed = output<void>();
  readonly primaryChanged = output<string | null>();

  protected readonly kinds = ATTACHMENT_KINDS;
  protected readonly uploadKind = signal<AttachmentKind>('image');
  protected readonly uploadProgress = signal<number | null>(null);

  protected readonly images = computed(() =>
    this.attachments().filter((a) => a.mimeType.startsWith('image/'))
  );
  protected readonly documents = computed(() =>
    this.attachments().filter((a) => !a.mimeType.startsWith('image/'))
  );

  protected readonly icons = {
    delete: mdiDelete,
    download: mdiDownload,
    paperclip: mdiPaperclip,
    star: mdiStar,
    starOutline: mdiStarOutline,
  };

  protected inlineUrl = (id: string) => attachmentUrl(id, true);
  protected downloadUrl = (id: string) => attachmentUrl(id, false);

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

  protected iconFor(att: AttachmentDto): string {
    if (att.mimeType === 'application/pdf') return mdiFilePdfBox;
    if (att.mimeType.startsWith('image/')) return mdiImageOutline;
    if (att.kind === 'invoice') return mdiReceiptTextOutline;
    return mdiFileDocumentOutline;
  }

  protected formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
          this.toast.success(`Uploaded ${file.name}`);
          this.changed.emit();
        }
      },
      error: () => this.uploadProgress.set(null),
    });
  }

  protected async remove(att: AttachmentDto): Promise<void> {
    const confirmed = await this.confirm.ask(
      `Delete "${att.title ?? att.originalName}"? The file is removed permanently.`,
      { confirmLabel: 'Delete' }
    );
    if (!confirmed) return;
    this.api.remove(att.id).subscribe(() => this.changed.emit());
  }

  protected togglePrimary(att: AttachmentDto): void {
    const next = this.primaryImageId() === att.id ? null : att.id;
    this.primaryChanged.emit(next);
  }
}
