import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  AREA_IMAGE_KINDS,
  AreaDto,
  AreaImageDto,
  AreaImageKind,
  AttachmentDto,
  DeviceDto,
} from '@smart-home-inventory/shared';
import {
  mdiDelete,
  mdiDevices,
  mdiImageMultipleOutline,
  mdiPencil,
  mdiPlus,
} from '@mdi/js';
import {
  AreaImagesApi,
  AreasApi,
  attachmentUrl,
  DevicesApi,
} from '../../core/api/api.services';
import { HttpClient } from '@angular/common/http';
import { ConfirmService } from '../../core/confirm/confirm.service';
import { ToastService } from '../../core/toast/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { AttachmentGalleryComponent } from '../attachments/attachment-gallery.component';
import { FileDropzoneComponent } from '../attachments/file-dropzone.component';
import { AreaFormDialogComponent } from './area-form-dialog.component';

@Component({
  selector: 'app-area-detail-page',
  imports: [
    RouterLink,
    FormsModule,
    IconComponent,
    EmptyStateComponent,
    AttachmentGalleryComponent,
    FileDropzoneComponent,
    AreaFormDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (area(); as a) {
      <div class="header">
        <div>
          <h1>{{ a.name }}</h1>
          <span class="muted">
            @if (a.floor) {
              {{ a.floor }} ·
            }
            @if (a.source === 'ha') {
              synced from Home Assistant
            } @else {
              manually created
            }
            @if (a.haOrphaned) {
              · <span class="warn">no longer in HA</span>
            }
          </span>
        </div>
        <div class="header-actions">
          <button class="btn secondary" (click)="editOpen.set(true)">
            <app-icon [path]="icons.pencil" [size]="18" /> Edit
          </button>
          <button class="btn danger" (click)="removeArea()">
            <app-icon [path]="icons.delete" [size]="18" /> Delete
          </button>
        </div>
      </div>

      @if (a.notes) {
        <div class="card section">
          <h3>Notes</h3>
          <p class="notes">{{ a.notes }}</p>
        </div>
      }

      <div class="card section">
        <div class="section-head">
          <h3>Devices ({{ devices().length }})</h3>
          <a class="btn secondary" routerLink="/devices/new" [queryParams]="{ areaId: a.id }">
            <app-icon [path]="icons.plus" [size]="18" /> Add device
          </a>
        </div>
        @if (devices().length > 0) {
          <table class="data">
            <tbody>
              @for (device of devices(); track device.id) {
                <tr class="clickable" (click)="openDevice(device)">
                  <td>{{ device.name }}</td>
                  <td class="muted">{{ device.manufacturer }} {{ device.model }}</td>
                  <td class="muted">{{ device.status }}</td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <app-empty-state [icon]="icons.devices" message="No devices in this area" />
        }
      </div>

      <div class="card section">
        <div class="section-head">
          <h3>Images &amp; plans ({{ images().length }})</h3>
        </div>
        <div class="image-grid">
          @for (img of sortedImages(); track img.id) {
            <a class="image-tile" [routerLink]="['/areas', a.id, 'images', img.id]">
              @if (img.imageAttachmentId) {
                <img [src]="thumbUrl(img.imageAttachmentId)" [alt]="img.name" />
              } @else {
                <div class="placeholder">
                  <app-icon [path]="icons.images" [size]="32" />
                </div>
              }
              <div class="tile-caption">
                <span class="tile-name">{{ img.name }}</span>
                <span class="tile-meta">
                  @if (img.kind) {
                    <span class="chip">{{ img.kind }}</span>
                  }
                  @if (img.annotations.items.length > 0) {
                    <span class="muted">{{ img.annotations.items.length }} ⌖</span>
                  }
                </span>
              </div>
            </a>
          }
          <div class="image-tile new">
            <input
              class="text"
              placeholder="Name (e.g. Floor plan, Fuse box)"
              [(ngModel)]="newImageName"
            />
            <select class="text" [(ngModel)]="newImageKind">
              <option value="">no type</option>
              @for (kind of imageKinds; track kind) {
                <option [value]="kind">{{ kind }}</option>
              }
            </select>
            <app-file-dropzone
              label="Add annotated image"
              accept="image/*"
              (files)="createImage($event)"
            />
          </div>
        </div>
      </div>

      <div class="card section">
        <h3>Attachments</h3>
        <app-attachment-gallery
          [owner]="{ areaId: a.id }"
          [attachments]="attachments()"
          (changed)="loadAttachments()"
        />
      </div>

      <app-area-form-dialog
        [open]="editOpen()"
        [area]="a"
        (closed)="editOpen.set(false)"
        (saved)="editOpen.set(false); load()"
      />
    }
  `,
  styles: `
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      gap: 12px;
      flex-wrap: wrap;
    }
    .header h1 {
      margin-bottom: 2px;
    }
    .header-actions {
      display: flex;
      gap: 4px;
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
    .notes {
      white-space: pre-wrap;
      margin: 0;
    }
    .warn {
      color: var(--warning-color);
    }
    .image-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }
    .image-tile {
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      overflow: hidden;
      color: inherit;
      display: flex;
      flex-direction: column;
    }
    .image-tile:hover {
      text-decoration: none;
      border-color: var(--primary-color);
    }
    .image-tile img,
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
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }
    .tile-meta {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .tile-name {
      font-weight: 500;
    }
    .image-tile.new {
      padding: 10px;
      gap: 8px;
      border-style: dashed;
    }
  `,
})
export class AreaDetailPageComponent implements OnInit {
  private readonly areasApi = inject(AreasApi);
  private readonly devicesApi = inject(DevicesApi);
  private readonly imagesApi = inject(AreaImagesApi);
  private readonly http = inject(HttpClient);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly areaId = input.required<string>();

  protected readonly area = signal<AreaDto | null>(null);
  protected readonly devices = signal<DeviceDto[]>([]);
  protected readonly images = signal<AreaImageDto[]>([]);
  protected readonly attachments = signal<AttachmentDto[]>([]);
  protected readonly editOpen = signal(false);
  protected newImageName = '';
  protected newImageKind: AreaImageKind | '' = '';
  protected readonly imageKinds = AREA_IMAGE_KINDS;

  /** Floor plans first — they act as the hub image of an area. */
  protected readonly sortedImages = computed(() =>
    [...this.images()].sort((a, b) => {
      const rank = (img: AreaImageDto) => (img.kind === 'floorplan' ? 0 : 1);
      return rank(a) - rank(b) || a.createdAt.localeCompare(b.createdAt);
    })
  );

  protected readonly icons = {
    pencil: mdiPencil,
    delete: mdiDelete,
    plus: mdiPlus,
    devices: mdiDevices,
    images: mdiImageMultipleOutline,
  };

  ngOnInit(): void {
    this.load();
  }

  protected thumbUrl = (attachmentId: string) => attachmentUrl(attachmentId, true);

  protected load(): void {
    const id = this.areaId();
    this.areasApi.get(id).subscribe((area) => this.area.set(area));
    this.devicesApi.list({ areaId: id }).subscribe((d) => this.devices.set(d));
    this.imagesApi.listForArea(id).subscribe((i) => this.images.set(i));
    this.loadAttachments();
  }

  protected loadAttachments(): void {
    // Area attachments = all attachments owned by the area, minus plan images
    // (those are shown in the images grid).
    this.http
      .get<AttachmentDto[]>(`api/areas/${this.areaId()}/attachments`)
      .subscribe((atts) => this.attachments.set(atts));
  }

  protected openDevice(device: DeviceDto): void {
    this.router.navigate(['/devices', device.id]);
  }

  protected createImage(files: File[]): void {
    const file = files[0];
    if (!file) return;
    const name = this.newImageName.trim() || file.name.replace(/\.[^.]+$/, '');
    const kind = this.newImageKind || undefined;
    this.imagesApi.create(this.areaId(), { name, kind }, file).subscribe((img) => {
      this.newImageName = '';
      this.newImageKind = '';
      this.toast.success('Image added');
      this.router.navigate(['/areas', this.areaId(), 'images', img.id]);
    });
  }

  protected async removeArea(): Promise<void> {
    const area = this.area();
    if (!area) return;
    const confirmed = await this.confirm.ask(
      `Delete area "${area.name}"? Devices in it are kept but unassigned; images and attachments are removed.`,
      { confirmLabel: 'Delete' }
    );
    if (!confirmed) return;
    this.areasApi.remove(area.id).subscribe(() => {
      this.toast.success('Area deleted');
      this.router.navigate(['/areas']);
    });
  }
}
