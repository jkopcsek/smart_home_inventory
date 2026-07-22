import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { AttachmentDto, DiagramDto } from '@smart-home-inventory/shared';
import { mdiHomeOutline } from '@mdi/js';
import { AttachmentsApi, DiagramsApi } from '../../core/api/api.services';
import { IconComponent } from '../../shared/ui/icon.component';
import { OwnerItemsComponent } from '../attachments/owner-items.component';

/**
 * "Home" isn't synced from Home Assistant (it has no registry entity for the
 * whole house — only Areas/Devices) — it's a local, always-present container
 * for diagrams/files that apply to the whole home rather than one Area.
 */
@Component({
  selector: 'app-home-detail-page',
  imports: [IconComponent, OwnerItemsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="header">
      <div>
        <h1><app-icon [path]="icons.home" [size]="24" /> Home</h1>
        <span class="muted">Diagrams and files for the whole home</span>
      </div>
    </div>

    <div class="card section">
      <app-owner-items
        [owner]="{ home: true }"
        [diagrams]="diagrams()"
        [attachments]="attachments()"
        (changed)="load()"
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
  `,
})
export class HomeDetailPageComponent implements OnInit {
  private readonly diagramsApi = inject(DiagramsApi);
  private readonly attachmentsApi = inject(AttachmentsApi);

  protected readonly diagrams = signal<DiagramDto[]>([]);
  protected readonly attachments = signal<AttachmentDto[]>([]);

  protected readonly icons = {
    home: mdiHomeOutline,
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
}
