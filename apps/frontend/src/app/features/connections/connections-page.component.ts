import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConnectionDto } from '@smart-home-inventory/shared';
import { mdiDelete, mdiPlus, mdiTransitConnectionVariant } from '@mdi/js';
import { ConnectionsApi } from '../../core/api/api.services';
import { ConfirmService } from '../../core/confirm/confirm.service';
import { ConnectionTypesStore } from '../../core/connection-types/connection-types.store';
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
      @for (group of connectionTypes.groups(); track group.group) {
        <span class="chip-group-label">{{ group.label }}</span>
        @for (t of group.types; track t.key) {
          <button
            class="chip"
            [class.active]="typeFilter() === t.key"
            (click)="typeFilter.set(typeFilter() === t.key ? null : t.key)"
          >
            <span class="type-dot" [style.background]="t.color"></span>
            {{ t.label }}
          </button>
        }
      }
    </div>

    @if (filteredConnections().length > 0) {
      <table class="data card connections">
        <thead>
          <tr>
            <th>Source</th>
            <th>Target</th>
            <th>Type</th>
            <th>Label</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (conn of filteredConnections(); track conn.id) {
            <tr>
              <td>
                <a [routerLink]="['/devices', conn.fromDeviceId]">{{ conn.fromDeviceName }}</a>
              </td>
              <td>
                <a [routerLink]="['/devices', conn.toDeviceId]">{{ conn.toDeviceName }}</a>
              </td>
              <td>
                <span class="type-dot" [style.background]="connectionTypes.color(conn.type)"></span>
                {{ connectionTypes.label(conn.type) }}
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
    } @else if (loaded()) {
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
    .type-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .connections td {
      vertical-align: middle;
    }
    .row-actions {
      text-align: right;
    }
  `,
})
export class ConnectionsPageComponent implements OnInit {
  private readonly api = inject(ConnectionsApi);
  private readonly confirm = inject(ConfirmService);
  protected readonly connectionTypes = inject(ConnectionTypesStore);

  protected readonly connections = signal<ConnectionDto[]>([]);
  protected readonly typeFilter = signal<string | null>(null);
  protected readonly loaded = signal(false);
  protected readonly dialogOpen = signal(false);

  protected readonly icons = {
    plus: mdiPlus,
    delete: mdiDelete,
    connections: mdiTransitConnectionVariant,
  };

  protected readonly filteredConnections = computed(() => {
    const filter = this.typeFilter();
    const order = this.connectionTypes.types().map((t) => t.key);
    const visible = this.connections().filter((c) => !filter || c.type === filter);
    return [...visible].sort((a, b) => {
      const typeDiff = order.indexOf(a.type) - order.indexOf(b.type);
      return typeDiff !== 0 ? typeDiff : a.fromDeviceName.localeCompare(b.fromDeviceName);
    });
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
      `Delete the ${this.connectionTypes.label(conn.type)} connection between "${conn.fromDeviceName}" and "${conn.toDeviceName}"?`,
      { confirmLabel: 'Delete' }
    );
    if (!confirmed) return;
    this.api.remove(conn.id).subscribe(() => this.load());
  }
}
