import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AreaDto,
  DeviceDto,
  DiagramDto,
} from '@smart-home-inventory/shared';
import { mdiChartTimelineVariant, mdiDelete, mdiPlus } from '@mdi/js';
import {
  AreasApi,
  DevicesApi,
  DiagramsApi,
} from '../../core/api/api.services';
import { ConfirmService } from '../../core/confirm/confirm.service';
import { ToastService } from '../../core/toast/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { MermaidViewComponent } from './mermaid-view.component';

const DEFAULT_SOURCE = `graph LR
  Breaker[F7 breaker] -->|230V L2| Switch[Wall switch]
  Switch --> Lamp[Ceiling lamp]
`;

@Component({
  selector: 'app-diagrams-page',
  imports: [FormsModule, IconComponent, EmptyStateComponent, MermaidViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="header">
      <h1>Diagrams</h1>
      <button class="btn" (click)="startNew()">
        <app-icon [path]="icons.plus" [size]="18" /> New diagram
      </button>
    </div>

    <div class="layout">
      <div class="list card">
        @for (diagram of diagrams(); track diagram.id) {
          <button
            class="item"
            [class.selected]="selected()?.id === diagram.id"
            (click)="select(diagram)"
          >
            <span>{{ diagram.title }}</span>
            <span class="muted">{{ anchorLabel(diagram) }}</span>
          </button>
        } @empty {
          <app-empty-state [icon]="icons.diagram" message="No diagrams yet" />
        }
      </div>

      @if (editing()) {
        <div class="editor card">
          <div class="editor-head">
            <input class="text title" placeholder="Title" [(ngModel)]="title" />
            <select class="text" [(ngModel)]="anchorKey">
              <option value="">standalone</option>
              <optgroup label="Areas">
                @for (area of areas(); track area.id) {
                  <option [value]="'area:' + area.id">{{ area.name }}</option>
                }
              </optgroup>
              <optgroup label="Devices">
                @for (device of devices(); track device.id) {
                  <option [value]="'device:' + device.id">{{ device.name }}</option>
                }
              </optgroup>
            </select>
            <button class="btn" [disabled]="!title.trim()" (click)="save()">Save</button>
            @if (selected(); as s) {
              <button class="btn icon-only" title="Delete" (click)="remove(s)">
                <app-icon [path]="icons.delete" [size]="18" />
              </button>
            }
          </div>
          <div class="panes">
            <textarea
              class="text source"
              rows="16"
              spellcheck="false"
              [(ngModel)]="source"
              (ngModelChange)="liveSource.set($event)"
            ></textarea>
            <div class="preview">
              <app-mermaid-view [source]="liveSource()" />
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .header h1 {
      margin: 0;
    }
    .layout {
      display: grid;
      grid-template-columns: 240px 1fr;
      gap: 16px;
      align-items: start;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px;
    }
    .item {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      font: inherit;
      background: none;
      border: none;
      border-radius: 6px;
      padding: 8px 10px;
      cursor: pointer;
      color: inherit;
      text-align: left;
      width: 100%;
    }
    .item:hover {
      background: var(--hover-color);
    }
    .item.selected {
      background: color-mix(in srgb, var(--primary-color) 15%, transparent);
    }
    .editor-head {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      align-items: center;
    }
    .editor-head .title {
      flex: 1;
    }
    .editor-head select {
      width: auto;
    }
    .panes {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .source {
      font-family: monospace;
      font-size: 13px;
      resize: vertical;
    }
    .preview {
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      padding: 12px;
      min-height: 200px;
    }
    @media (max-width: 860px) {
      .layout,
      .panes {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class DiagramsPageComponent implements OnInit {
  private readonly api = inject(DiagramsApi);
  private readonly areasApi = inject(AreasApi);
  private readonly devicesApi = inject(DevicesApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly diagrams = signal<DiagramDto[]>([]);
  protected readonly selected = signal<DiagramDto | null>(null);
  protected readonly editing = signal(false);
  protected readonly areas = signal<AreaDto[]>([]);
  protected readonly devices = signal<DeviceDto[]>([]);
  protected readonly liveSource = signal('');

  protected title = '';
  protected source = '';
  protected anchorKey = '';

  protected readonly icons = {
    plus: mdiPlus,
    delete: mdiDelete,
    diagram: mdiChartTimelineVariant,
  };

  ngOnInit(): void {
    this.load();
    this.areasApi.list().subscribe((areas) => this.areas.set(areas));
    this.devicesApi.list().subscribe((devices) => this.devices.set(devices));
  }

  protected load(): void {
    this.api.list().subscribe((diagrams) => this.diagrams.set(diagrams));
  }

  protected anchorLabel(diagram: DiagramDto): string {
    if (diagram.areaId) {
      return this.areas().find((a) => a.id === diagram.areaId)?.name ?? 'area';
    }
    if (diagram.deviceId) {
      return this.devices().find((d) => d.id === diagram.deviceId)?.name ?? 'device';
    }
    return '';
  }

  protected startNew(): void {
    this.selected.set(null);
    this.title = '';
    this.source = DEFAULT_SOURCE;
    this.liveSource.set(DEFAULT_SOURCE);
    this.anchorKey = '';
    this.editing.set(true);
  }

  protected select(diagram: DiagramDto): void {
    this.selected.set(diagram);
    this.title = diagram.title;
    this.source = diagram.source;
    this.liveSource.set(diagram.source);
    this.anchorKey = diagram.areaId
      ? `area:${diagram.areaId}`
      : diagram.deviceId
        ? `device:${diagram.deviceId}`
        : '';
    this.editing.set(true);
  }

  protected save(): void {
    const [kind, id] = this.anchorKey.split(':');
    const dto = {
      title: this.title.trim(),
      source: this.source,
      areaId: kind === 'area' ? id : null,
      deviceId: kind === 'device' ? id : null,
    };
    const current = this.selected();
    const req = current ? this.api.update(current.id, dto) : this.api.create(dto);
    req.subscribe((saved) => {
      this.toast.success('Diagram saved');
      this.selected.set(saved);
      this.load();
    });
  }

  protected async remove(diagram: DiagramDto): Promise<void> {
    const confirmed = await this.confirm.ask(`Delete diagram "${diagram.title}"?`, {
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;
    this.api.remove(diagram.id).subscribe(() => {
      this.editing.set(false);
      this.selected.set(null);
      this.load();
    });
  }
}
