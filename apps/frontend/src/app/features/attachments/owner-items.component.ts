import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { AttachmentDto, DiagramDto } from '@smart-home-inventory/shared';
import {
  mdiChartTimelineVariant,
  mdiFileDocumentOutline,
  mdiFilePdfBox,
  mdiImageOutline,
  mdiPaperclip,
  mdiPlus,
  mdiReceiptTextOutline,
} from '@mdi/js';
import { AttachmentOwner, attachmentUrl, DiagramsApi } from '../../core/api/api.services';
import { ToastService } from '../../core/toast/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { AttachmentUploadDialogComponent } from './attachment-upload-dialog.component';

interface Tile {
  kind: 'diagram' | 'attachment';
  id: string;
  title: string;
  subtitle: string;
  thumbnailUrl: string | null;
  typeIcon: string;
}

/**
 * Diagrams and attachments shown as one grid — both are "things attached to
 * this area/device/home" from the user's point of view, just with different
 * editors (the diagram canvas vs. the dedicated attachment view). See
 * diagram-canvas.component.ts and attachment-view-page.component.ts for why
 * they stay separate tables rather than merging at the DB level.
 */
@Component({
  selector: 'app-owner-items',
  imports: [IconComponent, EmptyStateComponent, AttachmentUploadDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section-head">
      <h3>Diagrams &amp; Attachments ({{ tiles().length }})</h3>
      <div class="head-actions">
        <button type="button" class="btn secondary" (click)="addDiagram()">
          <app-icon [path]="icons.plus" [size]="18" /> Add diagram
        </button>
        <button type="button" class="btn secondary" (click)="uploadDlg.open()">
          <app-icon [path]="icons.plus" [size]="18" /> Add attachment
        </button>
      </div>
    </div>

    @if (tiles().length > 0) {
      <div class="tile-grid">
        @for (tile of tiles(); track tile.kind + tile.id) {
          <button type="button" class="tile" (click)="open(tile)">
            @if (tile.thumbnailUrl) {
              <img [src]="tile.thumbnailUrl" alt="" />
            } @else {
              <div class="placeholder">
                <app-icon [path]="tile.typeIcon" [size]="32" />
              </div>
            }
            <div class="tile-caption">
              <span class="tile-name">
                <app-icon class="type-indicator" [path]="tile.typeIcon" [size]="14" />
                {{ tile.title }}
              </span>
              <span class="muted">{{ tile.subtitle }}</span>
            </div>
          </button>
        }
      </div>
    } @else {
      <app-empty-state [icon]="icons.paperclip" message="Nothing here yet" />
    }

    <app-attachment-upload-dialog #uploadDlg [owner]="owner()" (uploaded)="changed.emit()" />
  `,
  styles: `
    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      gap: 12px;
      flex-wrap: wrap;
    }
    .section-head h3 {
      margin: 0;
    }
    .head-actions {
      display: flex;
      gap: 8px;
    }
    .tile-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }
    .tile {
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      overflow: hidden;
      color: inherit;
      display: flex;
      flex-direction: column;
      font: inherit;
      background: none;
      cursor: pointer;
      text-align: left;
      padding: 0;
    }
    .tile:hover {
      border-color: var(--primary-color);
    }
    .tile img,
    .placeholder {
      width: 100%;
      height: 130px;
      object-fit: cover;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--secondary-text-color);
      background: var(--secondary-background-color);
    }
    .tile-caption {
      padding: 6px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 13px;
    }
    .tile-name {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
    }
    .type-indicator {
      flex-shrink: 0;
      color: var(--secondary-text-color);
    }
  `,
})
export class OwnerItemsComponent {
  private readonly diagramsApi = inject(DiagramsApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly owner = input.required<AttachmentOwner>();
  readonly diagrams = input.required<DiagramDto[]>();
  readonly attachments = input.required<AttachmentDto[]>();
  /** Parent should refetch both lists — a diagram was created or an attachment uploaded. */
  readonly changed = output<void>();

  protected readonly icons = { plus: mdiPlus, paperclip: mdiPaperclip };

  protected readonly tiles = computed<Tile[]>(() => {
    const diagramTiles: Tile[] = this.diagrams().map((d) => ({
      kind: 'diagram',
      id: d.id,
      title: d.title,
      subtitle: `${d.content.nodes.length} nodes`,
      thumbnailUrl: d.previewAttachmentId ? attachmentUrl(d.previewAttachmentId, true) : null,
      typeIcon: mdiChartTimelineVariant,
    }));
    // A diagram's preview is a generated snapshot managed by that diagram (see
    // diagram-canvas.component.ts#capturePreview) — it's already shown as the
    // diagram tile's own thumbnail above, so it shouldn't also show up as a
    // separate, seemingly-manageable attachment tile here.
    const previewIds = new Set(
      this.diagrams()
        .map((d) => d.previewAttachmentId)
        .filter((id): id is string => !!id)
    );
    const attachmentTiles: Tile[] = this.attachments()
      .filter((a) => !previewIds.has(a.id))
      .map((a) => ({
        kind: 'attachment',
        id: a.id,
        title: a.title ?? a.originalName,
        subtitle: this.formatSize(a.sizeBytes),
        thumbnailUrl: a.mimeType.startsWith('image/') ? attachmentUrl(a.id, true) : null,
        typeIcon: this.iconFor(a),
      }));
    return [...diagramTiles, ...attachmentTiles].sort((x, y) => x.title.localeCompare(y.title));
  });

  protected open(tile: Tile): void {
    if (tile.kind === 'diagram') {
      this.router.navigate(['/diagrams'], { queryParams: { ...this.diagramQueryParams(), open: tile.id } });
    } else {
      this.router.navigate(['/attachments', tile.id]);
    }
  }

  protected addDiagram(): void {
    this.diagramsApi.create({ title: 'Untitled diagram', ...this.diagramCreateDto() }).subscribe((diagram) => {
      this.toast.success('Diagram created');
      this.changed.emit();
      this.router.navigate(['/diagrams'], { queryParams: { ...this.diagramQueryParams(), open: diagram.id } });
    });
  }

  private diagramQueryParams(): Record<string, string> {
    const o = this.owner();
    if ('areaId' in o) return { areaId: o.areaId };
    if ('deviceId' in o) return { deviceId: o.deviceId };
    return { standalone: '1' };
  }

  private diagramCreateDto(): { areaId?: string; deviceId?: string } {
    const o = this.owner();
    if ('areaId' in o) return { areaId: o.areaId };
    if ('deviceId' in o) return { deviceId: o.deviceId };
    return {};
  }

  private iconFor(a: AttachmentDto): string {
    if (a.mimeType === 'application/pdf') return mdiFilePdfBox;
    if (a.mimeType.startsWith('image/')) return mdiImageOutline;
    if (a.kind === 'invoice') return mdiReceiptTextOutline;
    return mdiFileDocumentOutline;
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
