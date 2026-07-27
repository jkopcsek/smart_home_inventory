import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CONNECTION_TYPE_COLORS,
  CONNECTION_TYPE_GROUPS,
  CONNECTION_TYPE_LABELS,
  CONNECTION_TYPES_ORDERED,
  ConnectionDto,
  ConnectionType,
} from '@smart-home-inventory/shared';
import { mdiArrowRightThin, mdiDelete, mdiPlus, mdiTransitConnectionVariant } from '@mdi/js';
import { ConnectionsApi } from '../../core/api/api.services';
import { ConfirmService } from '../../core/confirm/confirm.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConnectionFormDialogComponent } from './connection-form-dialog.component';

@Component({
  selector: 'app-connections-page',
  imports: [
    RouterLink,
    IconComponent,
    EmptyStateComponent,
    ConnectionFormDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="header">
      <h1>Connections</h1>
      <button class="btn" (click)="dialogOpen.set(true)">
        <app-icon [path]="icons.plus" [size]="18" /> New connection
      </button>
    </div>

    <div class="chips">
      <button class="chip" [class.active]="!typeFilter()" (click)="typeFilter.set(null)">
        all
      </button>
      @for (group of typeGroups; track group.label) {
        <span class="chip-group-label">{{ group.label }}</span>
        @for (t of group.types; track t) {
          <button
            class="chip"
            [class.active]="typeFilter() === t"
            (click)="typeFilter.set(typeFilter() === t ? null : t)"
          >
            <span class="type-dot" [style.background]="typeColors[t]"></span>
            {{ typeLabels[t] }}
          </button>
        }
      }
    </div>

    @for (group of grouped(); track group.type) {
      <div class="card section">
        <h3>
          <span class="type-dot" [style.background]="typeColors[group.type]"></span>
          {{ typeLabels[group.type] }}
        </h3>
        <table class="data">
          <tbody>
            @for (conn of group.connections; track conn.id) {
              <tr>
                <td>
                  <a [routerLink]="['/devices', conn.fromDeviceId]">
                    {{ conn.fromDeviceName }}
                  </a>
                  <app-icon [path]="icons.arrow" [size]="16" class="muted" />
                  <a [routerLink]="['/devices', conn.toDeviceId]">
                    {{ conn.toDeviceName }}
                  </a>
                </td>
                <td class="muted">{{ conn.label }}</td>
                <td class="muted">{{ conn.notes }}</td>
                <td class="row-actions">
                  <button class="btn icon-only" title="Delete" (click)="remove(conn)">
                    <app-icon [path]="icons.delete" [size]="18" />
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (connections().length === 0 && loaded()) {
      <app-empty-state
        [icon]="icons.connections"
        message="No connections documented yet"
      />
    }

    <app-connection-form-dialog
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
      margin-bottom: 12px;
    }
    .header h1 {
      margin: 0;
    }
    .chips {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .chip-group-label {
      font-size: 12px;
      color: var(--secondary-text-color);
      margin: 0 2px 0 8px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .section h3 {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .type-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .section {
      margin-bottom: 16px;
    }
    .row-actions {
      text-align: right;
    }
  `,
})
export class ConnectionsPageComponent implements OnInit {
  private readonly api = inject(ConnectionsApi);
  private readonly confirm = inject(ConfirmService);

  protected readonly connections = signal<ConnectionDto[]>([]);
  protected readonly typeFilter = signal<ConnectionType | null>(null);
  protected readonly loaded = signal(false);
  protected readonly dialogOpen = signal(false);
  protected readonly typeGroups = CONNECTION_TYPE_GROUPS;
  protected readonly typeLabels = CONNECTION_TYPE_LABELS;
  protected readonly typeColors = CONNECTION_TYPE_COLORS;

  protected readonly icons = {
    plus: mdiPlus,
    delete: mdiDelete,
    arrow: mdiArrowRightThin,
    connections: mdiTransitConnectionVariant,
  };

  protected readonly grouped = computed(() => {
    const filter = this.typeFilter();
    const visible = this.connections().filter((c) => !filter || c.type === filter);
    const groups = new Map<ConnectionType, ConnectionDto[]>();
    for (const conn of visible) {
      if (!groups.has(conn.type)) groups.set(conn.type, []);
      groups.get(conn.type)?.push(conn);
    }
    return CONNECTION_TYPES_ORDERED.filter((type) => groups.has(type)).map((type) => ({
      type,
      connections: groups.get(type) as ConnectionDto[],
    }));
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api.list().subscribe((connections) => {
      this.connections.set(connections);
      this.loaded.set(true);
    });
  }

  protected async remove(conn: ConnectionDto): Promise<void> {
    const confirmed = await this.confirm.ask(
      `Delete the ${this.typeLabels[conn.type]} connection between "${conn.fromDeviceName}" and "${conn.toDeviceName}"?`,
      { confirmLabel: 'Delete' }
    );
    if (!confirmed) return;
    this.api.remove(conn.id).subscribe(() => this.load());
  }
}
