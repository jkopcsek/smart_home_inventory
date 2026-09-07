import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AreaDto } from '@smart-home-inventory/shared';
import { mdiFloorPlan, mdiHomeAlert, mdiHomeOutline, mdiPlus } from '@mdi/js';
import { AreasApi } from '../../core/api/api.services';
import { IconComponent } from '../../shared/ui/icon.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SourceBadgeComponent } from '../../shared/ui/source-badge.component';
import { AreaFormDialogComponent } from './area-form-dialog.component';

@Component({
  selector: 'app-area-list-page',
  imports: [
    RouterLink,
    IconComponent,
    EmptyStateComponent,
    SourceBadgeComponent,
    AreaFormDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="header">
      <h1>Areas</h1>
      <button class="btn" (click)="dialogOpen.set(true)">
        <app-icon [path]="icons.plus" [size]="18" /> New area
      </button>
    </div>

    <div class="grid home-grid">
      <a class="card area home" routerLink="/home">
        <div class="row">
          <span class="name"><app-icon [path]="icons.home" [size]="18" /> Home</span>
        </div>
        <span class="muted">Diagrams and files for the whole home</span>
      </a>
    </div>

    @for (group of grouped(); track group.floorId) {
      @if (group.floorName) {
        <h3 class="floor">{{ group.floorName }}</h3>
      }
      <div class="grid">
        @for (area of group.areas; track area.id) {
          <a class="card area" [routerLink]="['/areas', area.id]">
            <div class="row">
              <span class="name">{{ area.name }}</span>
              @if (area.haOrphaned) {
                <app-icon
                  [path]="icons.orphaned"
                  [size]="18"
                  class="warn"
                  title="No longer exists in Home Assistant"
                />
              }
            </div>
            <div class="row">
              <span class="muted">
                {{ area.deviceCount }} device{{ area.deviceCount === 1 ? '' : 's' }}
                @if (area.diagramCount > 0) {
                  · {{ area.diagramCount }} diagram{{ area.diagramCount === 1 ? '' : 's' }}
                }
              </span>
              <app-source-badge [source]="area.source" />
            </div>
          </a>
        }
      </div>
    }

    @if (areas().length === 0 && loaded()) {
      <app-empty-state
        [icon]="icons.floorPlan"
        message="No areas yet. Create one or sync from Home Assistant in Settings."
      />
    }

    <app-area-form-dialog
      [open]="dialogOpen()"
      (closed)="dialogOpen.set(false)"
      (saved)="dialogOpen.set(false); load()"
    />
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
    .floor {
      margin: 20px 0 8px;
      color: var(--secondary-text-color);
    }
    .home-grid {
      margin-bottom: 8px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
    }
    .area {
      display: flex;
      flex-direction: column;
      gap: 4px;
      color: inherit;
    }
    .area.home .name {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .area:hover {
      text-decoration: none;
      border-color: var(--primary-color);
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .name {
      font-size: 16px;
      font-weight: 500;
    }
    .warn {
      color: var(--warning-color);
    }
  `,
})
export class AreaListPageComponent {
  private readonly api = inject(AreasApi);

  protected readonly areas = signal<AreaDto[]>([]);
  protected readonly loaded = signal(false);
  protected readonly dialogOpen = signal(false);
  protected readonly icons = {
    plus: mdiPlus,
    floorPlan: mdiFloorPlan,
    orphaned: mdiHomeAlert,
    home: mdiHomeOutline,
  };

  protected readonly grouped = computed(() => {
    const groups = new Map<string, { floorName: string | null; areas: AreaDto[] }>();
    for (const area of this.areas()) {
      const key = area.floorId ?? '';
      if (!groups.has(key)) groups.set(key, { floorName: area.floorName, areas: [] });
      groups.get(key)?.areas.push(area);
    }
    return Array.from(groups.entries()).map(([floorId, group]) => ({ floorId, ...group }));
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.api.list().subscribe((areas) => {
      this.areas.set(areas);
      this.loaded.set(true);
    });
  }
}
