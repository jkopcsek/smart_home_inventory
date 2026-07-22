import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DiagramDto } from '@smart-home-inventory/shared';
import { mdiArrowLeft, mdiChartTimelineVariant } from '@mdi/js';
import { DiagramsApi } from '../../core/api/api.services';
import { IconComponent } from '../../shared/ui/icon.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { DiagramCanvasComponent } from './diagram-canvas.component';

@Component({
  selector: 'app-diagrams-page',
  imports: [IconComponent, EmptyStateComponent, DiagramCanvasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="header">
      <button type="button" class="btn secondary" (click)="back()">
        <app-icon [path]="icons.back" [size]="18" /> Back
      </button>
      <h1>Diagrams</h1>
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
            <span class="muted">{{ diagram.content.nodes.length }} nodes</span>
          </button>
        } @empty {
          <app-empty-state [icon]="icons.diagram" message="No diagrams yet" />
        }
      </div>

      @if (selected(); as s) {
        <div class="detail">
          <app-diagram-canvas
            [diagramId]="s.id"
            [areaId]="areaId()"
            [deviceId]="deviceId()"
            (saved)="onSaved($event)"
            (deleted)="onDeleted(s)"
          />
        </div>
      }
    </div>
  `,
  styles: `
    /* The diagram canvas needs real screen space — opt this page out of the
       app-wide 1100px content cap set by main > * in styles.scss/app.ts. */
    :host {
      display: block;
      max-width: none;
      width: 100%;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
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
    .detail {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    @media (max-width: 860px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class DiagramsPageComponent implements OnInit {
  private readonly api = inject(DiagramsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly diagrams = signal<DiagramDto[]>([]);
  protected readonly selected = signal<DiagramDto | null>(null);
  protected readonly areaId = signal<string | null>(null);
  protected readonly deviceId = signal<string | null>(null);
  protected readonly standalone = signal(false);

  protected readonly icons = {
    back: mdiArrowLeft,
    diagram: mdiChartTimelineVariant,
  };

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.areaId.set(params.get('areaId'));
      this.deviceId.set(params.get('deviceId'));
      this.standalone.set(params.get('standalone') === '1');
      const openId = params.get('open');
      this.load(openId ?? undefined);
    });
  }

  private load(openId?: string): void {
    const areaId = this.areaId();
    const deviceId = this.deviceId();
    const q = areaId ? { areaId } : deviceId ? { deviceId } : { standalone: '1' as const };
    this.api.list(q).subscribe((diagrams) => {
      this.diagrams.set(diagrams);
      const toSelect = openId
        ? diagrams.find((d) => d.id === openId)
        : this.selected()
          ? diagrams.find((d) => d.id === this.selected()?.id)
          : undefined;
      this.selectQuiet(toSelect ?? null);
    });
  }

  protected select(diagram: DiagramDto): void {
    this.selectQuiet(diagram);
  }

  private selectQuiet(diagram: DiagramDto | null): void {
    this.selected.set(diagram);
  }

  protected back(): void {
    const areaId = this.areaId();
    const deviceId = this.deviceId();
    if (areaId) this.router.navigate(['/areas', areaId]);
    else if (deviceId) this.router.navigate(['/devices', deviceId]);
    else this.router.navigate(['/home']);
  }

  protected onSaved(updated: DiagramDto): void {
    this.diagrams.update((list) => list.map((d) => (d.id === updated.id ? updated : d)));
    if (this.selected()?.id === updated.id) this.selected.set(updated);
  }

  protected onDeleted(diagram: DiagramDto): void {
    this.diagrams.update((list) => list.filter((d) => d.id !== diagram.id));
    this.selected.set(null);
  }
}
