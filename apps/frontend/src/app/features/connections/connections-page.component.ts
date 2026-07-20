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
  CONNECTION_TYPES,
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
      @for (t of types; track t) {
        <button
          class="chip"
          [class.active]="typeFilter() === t"
          (click)="typeFilter.set(typeFilter() === t ? null : t)"
        >
          {{ t }}
        </button>
      }
    </div>

    @for (group of grouped(); track group.type) {
      <div class="card section">
        <h3>{{ group.type }}</h3>
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
      gap: 4px;
      flex-wrap: wrap;
      margin-bottom: 16px;
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
  protected readonly types = CONNECTION_TYPES;

  protected readonly icons = {
    plus: mdiPlus,
    delete: mdiDelete,
    arrow: mdiArrowRightThin,
    connections: mdiTransitConnectionVariant,
  };

  protected readonly grouped = computed(() => {
    const filter = this.typeFilter();
    const visible = this.connections().filter((c) => !filter || c.type === filter);
    const groups = new Map<string, ConnectionDto[]>();
    for (const conn of visible) {
      if (!groups.has(conn.type)) groups.set(conn.type, []);
      groups.get(conn.type)?.push(conn);
    }
    return Array.from(groups.entries()).map(([type, connections]) => ({
      type,
      connections,
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
      `Delete the ${conn.type} connection between "${conn.fromDeviceName}" and "${conn.toDeviceName}"?`,
      { confirmLabel: 'Delete' }
    );
    if (!confirmed) return;
    this.api.remove(conn.id).subscribe(() => this.load());
  }
}
