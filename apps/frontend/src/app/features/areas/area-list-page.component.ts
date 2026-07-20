import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AreaDto } from '@smart-home-inventory/shared';
import { mdiFloorPlan, mdiHomeAlert, mdiPlus } from '@mdi/js';
import { AreasApi } from '../../core/api/api.services';
import { IconComponent } from '../../shared/ui/icon.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { AreaFormDialogComponent } from './area-form-dialog.component';

@Component({
  selector: 'app-area-list-page',
  imports: [RouterLink, IconComponent, EmptyStateComponent, AreaFormDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="header">
      <h1>Areas</h1>
      <button class="btn" (click)="dialogOpen.set(true)">
        <app-icon [path]="icons.plus" [size]="18" /> New area
      </button>
    </div>

    @for (group of grouped(); track group.floor) {
      @if (group.floor) {
        <h3 class="floor">{{ group.floor }}</h3>
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
            <span class="muted">
              {{ area.deviceCount }} device{{ area.deviceCount === 1 ? '' : 's' }}
              @if (area.imageCount > 0) {
                · {{ area.imageCount }} image{{ area.imageCount === 1 ? '' : 's' }}
              }
              @if (area.source === 'ha') {
                · from HA
              }
            </span>
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
  };

  protected readonly grouped = computed(() => {
    const groups = new Map<string, AreaDto[]>();
    for (const area of this.areas()) {
      const key = area.floor ?? '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(area);
    }
    return Array.from(groups.entries()).map(([floor, areas]) => ({ floor, areas }));
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
