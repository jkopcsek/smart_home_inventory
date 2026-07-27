import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DiagramDto } from '@smart-home-inventory/shared';
import { mdiArrowLeft, mdiChartTimelineVariant, mdiChevronDown } from '@mdi/js';
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
      <button type="button" class="list-toggle" (click)="listOpen.set(!listOpen())">
        <span>{{ diagrams().length }} diagram{{ diagrams().length === 1 ? '' : 's' }}</span>
        <app-icon [path]="icons.chevron" [size]="18" [class.flipped]="listOpen()" />
      </button>
      <div class="list card" [class.list-open]="listOpen()">
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
    .list-toggle {
      display: none;
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
      /* The diagram itself matters far more than the list of other diagrams
         on a narrow screen — show it first, and keep the list collapsed
         behind a toggle instead of always eating into the canvas's space. */
      .detail {
        order: -1;
      }
      .list-toggle {
        order: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        font: inherit;
        background: none;
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        padding: 8px 12px;
        cursor: pointer;
        color: inherit;
      }
      .list-toggle app-icon.flipped {
        transform: rotate(180deg);
      }
      .list {
        display: none;
        order: 0;
        max-height: 240px;
        overflow-y: auto;
      }
      .list.list-open {
        display: flex;
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
  /** Only meaningful below the mobile breakpoint — the list is always
   *  visible in the side-by-side desktop layout regardless of this. */
  protected readonly listOpen = signal(false);

  protected readonly icons = {
    back: mdiArrowLeft,
    diagram: mdiChartTimelineVariant,
    chevron: mdiChevronDown,
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
