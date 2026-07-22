import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Location } from '@angular/common';
import { ATTACHMENT_KINDS, AttachmentDto, AttachmentKind } from '@smart-home-inventory/shared';
import {
  mdiArrowLeft,
  mdiContentSave,
  mdiDelete,
  mdiDownload,
  mdiFileDocumentOutline,
  mdiFilePdfBox,
  mdiImageOutline,
  mdiPencil,
  mdiReceiptTextOutline,
  mdiStar,
  mdiStarOutline,
} from '@mdi/js';
import { attachmentUrl, AttachmentsApi, DevicesApi } from '../../core/api/api.services';
import { ConfirmService } from '../../core/confirm/confirm.service';
import { ToastService } from '../../core/toast/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';

/**
 * Single-attachment view, mirroring the diagram canvas's read-only/Edit/Save
 * pattern: opens read-only (title and kind as plain text), "Edit" unlocks
 * the two editable fields, "Save" persists and locks back down.
 */
@Component({
  selector: 'app-attachment-view-page',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (attachment(); as a) {
      <button type="button" class="btn secondary back" (click)="back()">
        <app-icon [path]="icons.back" [size]="18" /> Back
      </button>

      <div class="card viewer">
        @if (isImage()) {
          <img class="preview" [src]="inlineUrl(a.id)" [alt]="a.title ?? a.originalName" />
        } @else {
          <div class="file-preview">
            <app-icon [path]="iconFor(a)" [size]="48" />
            <a class="btn secondary" [href]="downloadUrl(a.id)" [download]="a.originalName">
              <app-icon [path]="icons.download" [size]="16" /> Download {{ a.originalName }}
            </a>
          </div>
        }

        <div class="meta">
          @if (readOnly()) {
            <h1>{{ a.title || a.originalName }}</h1>
            <span class="kind-badge muted">{{ a.kind }}</span>
          } @else {
            <label class="field">
              <span>Title</span>
              <input class="text" [value]="titleDraft()" (change)="onTitleChange($event)" />
            </label>
            <label class="field">
              <span>Type</span>
              <select class="text" [value]="kindDraft()" (change)="onKindChange($event)">
                @for (kind of kinds; track kind) {
                  <option [value]="kind">{{ kind }}</option>
                }
              </select>
            </label>
          }

          <span class="muted size">{{ formatSize(a.sizeBytes) }} · uploaded {{ formattedDate(a) }}</span>

          @if (isImage() && a.deviceId) {
            <button type="button" class="btn secondary" (click)="togglePrimary(a)">
              <app-icon [path]="isPrimary() ? icons.star : icons.starOutline" [size]="16" />
              {{ isPrimary() ? 'Primary photo' : 'Set as primary photo' }}
            </button>
          }

          <div class="actions">
            @if (readOnly()) {
              <button type="button" class="btn secondary" (click)="enterEdit()">
                <app-icon [path]="icons.edit" [size]="16" /> Edit
              </button>
            } @else {
              <button type="button" class="btn danger" (click)="remove(a)">
                <app-icon [path]="icons.delete" [size]="16" /> Delete
              </button>
              <button type="button" class="btn" (click)="save(a)">
                <app-icon [path]="icons.save" [size]="16" /> Save
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .back {
      margin-bottom: 16px;
    }
    .viewer {
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-width: 640px;
    }
    .preview {
      width: 100%;
      max-height: 480px;
      object-fit: contain;
      border-radius: 8px;
      background: var(--secondary-background-color);
    }
    .file-preview {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 48px 16px;
      border-radius: 8px;
      background: var(--secondary-background-color);
      color: var(--secondary-text-color);
    }
    .meta {
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: flex-start;
    }
    .meta h1 {
      margin: 0;
    }
    .kind-badge {
      text-transform: capitalize;
    }
    .size {
      font-size: 13px;
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
  `,
})
export class AttachmentViewPageComponent implements OnInit {
  private readonly api = inject(AttachmentsApi);
  private readonly devicesApi = inject(DevicesApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly location = inject(Location);

  readonly attachmentId = input.required<string>();

  protected readonly attachment = signal<AttachmentDto | null>(null);
  protected readonly readOnly = signal(true);
  protected readonly titleDraft = signal('');
  protected readonly kindDraft = signal<AttachmentKind>('other');
  protected readonly primaryImageId = signal<string | null>(null);

  protected readonly kinds = ATTACHMENT_KINDS;

  protected readonly isImage = computed(() => this.attachment()?.mimeType.startsWith('image/') ?? false);
  protected readonly isPrimary = computed(() => {
    const a = this.attachment();
    return !!a && this.primaryImageId() === a.id;
  });

  protected readonly icons = {
    back: mdiArrowLeft,
    edit: mdiPencil,
    save: mdiContentSave,
    delete: mdiDelete,
    download: mdiDownload,
    star: mdiStar,
    starOutline: mdiStarOutline,
  };

  protected inlineUrl = (id: string) => attachmentUrl(id, true);
  protected downloadUrl = (id: string) => attachmentUrl(id, false);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.get(this.attachmentId()).subscribe((a) => {
      this.attachment.set(a);
      this.titleDraft.set(a.title ?? '');
      this.kindDraft.set(a.kind);
      this.primaryImageId.set(null);
      if (a.deviceId) {
        this.devicesApi.get(a.deviceId).subscribe((d) => this.primaryImageId.set(d.primaryImageId));
      }
    });
  }

  protected enterEdit(): void {
    this.readOnly.set(false);
  }

  protected onTitleChange(event: Event): void {
    this.titleDraft.set((event.target as HTMLInputElement).value);
  }

  protected onKindChange(event: Event): void {
    this.kindDraft.set((event.target as HTMLSelectElement).value as AttachmentKind);
  }

  protected save(a: AttachmentDto): void {
    this.api.update(a.id, { title: this.titleDraft().trim() || null, kind: this.kindDraft() }).subscribe((updated) => {
      this.attachment.set(updated);
      this.readOnly.set(true);
      this.toast.success('Attachment saved');
    });
  }

  protected togglePrimary(a: AttachmentDto): void {
    if (!a.deviceId) return;
    const next = this.isPrimary() ? null : a.id;
    this.devicesApi
      .setPrimaryImage(a.deviceId, next)
      .subscribe((d) => this.primaryImageId.set(d.primaryImageId));
  }

  protected async remove(a: AttachmentDto): Promise<void> {
    const confirmed = await this.confirm.ask(
      `Delete "${a.title ?? a.originalName}"? The file is removed permanently.`,
      { confirmLabel: 'Delete' }
    );
    if (!confirmed) return;
    this.api.remove(a.id).subscribe(() => {
      this.toast.success('Attachment deleted');
      this.back();
    });
  }

  protected back(): void {
    this.location.back();
  }

  protected iconFor(a: AttachmentDto): string {
    if (a.mimeType === 'application/pdf') return mdiFilePdfBox;
    if (a.mimeType.startsWith('image/')) return mdiImageOutline;
    if (a.kind === 'invoice') return mdiReceiptTextOutline;
    return mdiFileDocumentOutline;
  }

  protected formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  protected formattedDate(a: AttachmentDto): string {
    return new Date(a.createdAt).toLocaleDateString();
  }
}
