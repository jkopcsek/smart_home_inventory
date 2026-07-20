import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AttachmentDto, DiagramDto } from '@smart-home-inventory/shared';
import { mdiChartTimelineVariant, mdiHomeOutline, mdiPlus } from '@mdi/js';
import { AttachmentsApi, DiagramsApi } from '../../core/api/api.services';
import { ToastService } from '../../core/toast/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { AttachmentGalleryComponent } from '../attachments/attachment-gallery.component';

/**
 * "Home" isn't synced from Home Assistant (it has no registry entity for the
 * whole house — only Areas/Devices) — it's a local, always-present container
 * for diagrams/files that apply to the whole home rather than one Area.
 */
@Component({
  selector: 'app-home-detail-page',
  imports: [FormsModule, IconComponent, AttachmentGalleryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="header">
      <div>
        <h1><app-icon [path]="icons.home" [size]="24" /> Home</h1>
        <span class="muted">Diagrams and files for the whole home</span>
      </div>
    </div>

    <div class="card section">
      <div class="section-head">
        <h3>Diagrams ({{ diagrams().length }})</h3>
      </div>
      <div class="grid">
        @for (d of diagrams(); track d.id) {
          <button type="button" class="tile" (click)="openDiagram(d)">
            <div class="placeholder">
              <app-icon [path]="icons.diagram" [size]="32" />
            </div>
            <div class="tile-caption">
              <span class="tile-name">{{ d.title }}</span>
              <span class="muted">{{ d.content.nodes.length }} nodes</span>
            </div>
          </button>
        }
        <div class="tile new">
          <input class="text" placeholder="Name (e.g. Internet, Fuse box)" [(ngModel)]="newDiagramTitle" />
          <button class="btn secondary" [disabled]="!newDiagramTitle.trim()" (click)="createDiagram()">
            <app-icon [path]="icons.plus" [size]="18" /> New diagram
          </button>
        </div>
      </div>
    </div>

    <div class="card section">
      <h3>Attachments</h3>
      <app-attachment-gallery
        [owner]="{ home: true }"
        [attachments]="attachments()"
        (changed)="loadAttachments()"
      />
    </div>
  `,
  styles: `
    .header {
      margin-bottom: 16px;
    }
    .header h1 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 2px;
    }
    .section {
      margin-bottom: 16px;
    }
    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .section-head h3 {
      margin: 0;
    }
    .grid {
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
    .placeholder {
      width: 100%;
      height: 130px;
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
      font-weight: 500;
    }
    .tile.new {
      padding: 10px;
      gap: 8px;
      border-style: dashed;
    }
  `,
})
export class HomeDetailPageComponent implements OnInit {
  private readonly diagramsApi = inject(DiagramsApi);
  private readonly attachmentsApi = inject(AttachmentsApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly diagrams = signal<DiagramDto[]>([]);
  protected readonly attachments = signal<AttachmentDto[]>([]);
  protected newDiagramTitle = '';

  protected readonly icons = {
    home: mdiHomeOutline,
    plus: mdiPlus,
    diagram: mdiChartTimelineVariant,
  };

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.diagramsApi.list({ standalone: '1' }).subscribe((d) => this.diagrams.set(d));
    this.loadAttachments();
  }

  protected loadAttachments(): void {
    this.attachmentsApi.listForOwner({ home: true }).subscribe((atts) => this.attachments.set(atts));
  }

  protected openDiagram(diagram: DiagramDto): void {
    this.router.navigate(['/diagrams'], { queryParams: { standalone: '1', open: diagram.id } });
  }

  protected createDiagram(): void {
    const title = this.newDiagramTitle.trim();
    if (!title) return;
    this.diagramsApi.create({ title }).subscribe((diagram) => {
      this.newDiagramTitle = '';
      this.toast.success('Diagram created');
      this.router.navigate(['/diagrams'], { queryParams: { standalone: '1', open: diagram.id } });
    });
  }
}
