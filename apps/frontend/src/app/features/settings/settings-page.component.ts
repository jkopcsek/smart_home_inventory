import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CAPABILITY_CATEGORIES,
  CapabilityCategory,
  CapabilityTypeDto,
  CONNECTION_TYPE_GROUPS,
  ConnectionTypeDto,
  ConnectionTypeGroup,
  HaStatusDto,
  SyncResultDto,
} from '@smart-home-inventory/shared';
import { mdiDelete, mdiSync } from '@mdi/js';
import { CapabilitiesApi, ConnectionTypesApi, HaApi } from '../../core/api/api.services';
import { ConfirmService } from '../../core/confirm/confirm.service';
import { ConnectionTypesStore } from '../../core/connection-types/connection-types.store';
import { ToastService } from '../../core/toast/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Settings</h1>

    <div class="card section">
      <h3>Home Assistant sync</h3>
      @if (status(); as s) {
        <p class="muted">
          Mode: <b>{{ s.mode }}</b> ·
          {{ s.connected ? 'connected' : 'not reachable' }}
          · {{ s.readOnly ? 'read-only' : 'write access enabled' }}
          @if (s.lastSyncAt) {
            · last sync {{ s.lastSyncAt.slice(0, 16).replace('T', ' ') }}
          }
        </p>
        @if (s.readOnly) {
          <p class="muted">
            The app only reads from Home Assistant (area &amp; device
            registries); it never writes anything back.
          </p>
        }
        @if (s.mode === 'mock') {
          <p class="muted">
            Running against built-in fixtures. Set <code>HA_URL</code> +
            <code>HA_TOKEN</code> (dev) or install as an add-on (production) to
            sync a real instance.
          </p>
        }
      }
      <button class="btn" [disabled]="syncing()" (click)="sync()">
        <app-icon [path]="icons.sync" [size]="18" />
        {{ syncing() ? 'Syncing…' : 'Sync floors, areas & devices from Home Assistant' }}
      </button>
      @if (lastResult(); as r) {
        <table class="data result">
          <thead>
            <tr>
              <th></th>
              <th>Created</th>
              <th>Updated</th>
              <th>Orphaned</th>
              <th>Unchanged</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Floors</td>
              <td>{{ r.floors.created }}</td>
              <td>{{ r.floors.updated }}</td>
              <td>{{ r.floors.orphaned }}</td>
              <td>{{ r.floors.unchanged }}</td>
            </tr>
            <tr>
              <td>Areas</td>
              <td>{{ r.areas.created }}</td>
              <td>{{ r.areas.updated }}</td>
              <td>{{ r.areas.orphaned }}</td>
              <td>{{ r.areas.unchanged }}</td>
            </tr>
            <tr>
              <td>Devices</td>
              <td>{{ r.devices.created }}</td>
              <td>{{ r.devices.updated }}</td>
              <td>{{ r.devices.orphaned }}</td>
              <td>{{ r.devices.unchanged }}</td>
            </tr>
          </tbody>
        </table>
        @for (warning of r.warnings; track warning) {
          <p class="warn">{{ warning }}</p>
        }
      }
    </div>

    <div class="card section">
      <h3>Capability types</h3>
      <p class="muted">
        Built-in types cannot be deleted; add your own for anything missing
        (DALI, 1-Wire, …).
      </p>
      <table class="data">
        <tbody>
          @for (cap of capabilities(); track cap.id) {
            <tr>
              <td><span class="chip">{{ cap.key }}</span></td>
              <td>{{ cap.label }}</td>
              <td class="muted">{{ cap.category }}</td>
              <td class="muted">
                {{ cap.deviceCount }} device{{ cap.deviceCount === 1 ? '' : 's' }}
              </td>
              <td class="row-actions">
                @if (!cap.isSystem) {
                  <button
                    class="btn icon-only"
                    title="Delete"
                    (click)="removeCapability(cap)"
                  >
                    <app-icon [path]="icons.delete" [size]="18" />
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
      <form class="new-cap" (ngSubmit)="addCapability()">
        <input
          class="text"
          name="key"
          placeholder="key (e.g. dali)"
          pattern="[a-z0-9_]+"
          [(ngModel)]="newKey"
        />
        <input class="text" name="label" placeholder="Label" [(ngModel)]="newLabel" />
        <select class="text" name="category" [(ngModel)]="newCategory">
          @for (cat of categories; track cat) {
            <option [value]="cat">{{ cat }}</option>
          }
        </select>
        <button class="btn" type="submit" [disabled]="!newKey.trim() || !newLabel.trim()">
          Add
        </button>
      </form>
    </div>

    <div class="card section">
      <h3>Connection types</h3>
      <p class="muted">
        The wire/protocol types available on connections and diagram
        wires/ports. Built-in types cannot be deleted; add your own for
        anything missing (DALI, 1-Wire, …).
      </p>
      <table class="data">
        <tbody>
          @for (type of connectionTypes.types(); track type.id) {
            <tr>
              <td><span class="chip">{{ type.key }}</span></td>
              <td>{{ type.label }}</td>
              <td class="muted">{{ type.group }}</td>
              <td>
                <span class="swatch" [style.background]="type.color"></span>
              </td>
              <td class="muted">
                {{ type.connectionCount }} connection{{ type.connectionCount === 1 ? '' : 's' }}
              </td>
              <td class="row-actions">
                @if (!type.isSystem) {
                  <button
                    class="btn icon-only"
                    title="Delete"
                    (click)="removeConnectionType(type)"
                  >
                    <app-icon [path]="icons.delete" [size]="18" />
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
      <form class="new-cap" (ngSubmit)="addConnectionType()">
        <input
          class="text"
          name="ctKey"
          placeholder="key (e.g. dali)"
          pattern="[a-z0-9_]+"
          [(ngModel)]="newTypeKey"
        />
        <input class="text" name="ctLabel" placeholder="Label" [(ngModel)]="newTypeLabel" />
        <select class="text" name="ctGroup" [(ngModel)]="newTypeGroup">
          @for (g of connectionTypeGroups; track g) {
            <option [value]="g">{{ g }}</option>
          }
        </select>
        <input class="color" type="color" name="ctColor" [(ngModel)]="newTypeColor" />
        <button
          class="btn"
          type="submit"
          [disabled]="!newTypeKey.trim() || !newTypeLabel.trim()"
        >
          Add
        </button>
      </form>
    </div>
  `,
  styles: `
    .section {
      margin-bottom: 16px;
    }
    .result {
      margin-top: 12px;
      max-width: 480px;
    }
    .warn {
      color: var(--warning-color);
    }
    .new-cap {
      display: flex;
      gap: 8px;
      margin-top: 12px;
      flex-wrap: wrap;
    }
    .new-cap input,
    .new-cap select {
      width: auto;
      flex: 1;
      min-width: 120px;
    }
    .new-cap input.color {
      flex: 0 0 auto;
      width: 44px;
      min-width: 44px;
      padding: 2px;
    }
    .row-actions {
      text-align: right;
    }
    .swatch {
      display: block;
      width: 20px;
      height: 20px;
      border-radius: 4px;
      border: 1px solid var(--divider-color);
    }
    code {
      background: var(--chip-background-color);
      border-radius: 4px;
      padding: 1px 4px;
    }
  `,
})
export class SettingsPageComponent implements OnInit {
  private readonly haApi = inject(HaApi);
  private readonly capabilitiesApi = inject(CapabilitiesApi);
  private readonly connectionTypesApi = inject(ConnectionTypesApi);
  protected readonly connectionTypes = inject(ConnectionTypesStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly status = signal<HaStatusDto | null>(null);
  protected readonly lastResult = signal<SyncResultDto | null>(null);
  protected readonly syncing = signal(false);
  protected readonly capabilities = signal<CapabilityTypeDto[]>([]);
  protected readonly categories = CAPABILITY_CATEGORIES;
  protected readonly connectionTypeGroups = CONNECTION_TYPE_GROUPS;
  protected readonly icons = { sync: mdiSync, delete: mdiDelete };

  protected newKey = '';
  protected newLabel = '';
  protected newCategory: CapabilityCategory = 'other';

  protected newTypeKey = '';
  protected newTypeLabel = '';
  protected newTypeGroup: ConnectionTypeGroup = 'other';
  protected newTypeColor = '#757575';

  ngOnInit(): void {
    this.haApi.status().subscribe((status) => {
      this.status.set(status);
      this.lastResult.set(status.lastSyncResult);
    });
    this.loadCapabilities();
  }

  protected sync(): void {
    this.syncing.set(true);
    this.haApi.sync().subscribe({
      next: (result) => {
        this.syncing.set(false);
        this.lastResult.set(result);
        this.toast.success(
          `Synced: ${result.floors.created + result.areas.created + result.devices.created} created, ` +
            `${result.floors.updated + result.areas.updated + result.devices.updated} updated`
        );
      },
      error: () => this.syncing.set(false),
    });
  }

  protected loadCapabilities(): void {
    this.capabilitiesApi.listTypes().subscribe((caps) => this.capabilities.set(caps));
  }

  protected addCapability(): void {
    const key = this.newKey.trim();
    const label = this.newLabel.trim();
    if (!key || !label) return;
    this.capabilitiesApi
      .createType({ key, label, category: this.newCategory })
      .subscribe(() => {
        this.newKey = '';
        this.newLabel = '';
        this.loadCapabilities();
      });
  }

  protected async removeCapability(cap: CapabilityTypeDto): Promise<void> {
    const confirmed = await this.confirm.ask(`Delete capability "${cap.label}"?`, {
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;
    this.capabilitiesApi.removeType(cap.id).subscribe(() => this.loadCapabilities());
  }

  protected addConnectionType(): void {
    const key = this.newTypeKey.trim();
    const label = this.newTypeLabel.trim();
    if (!key || !label) return;
    this.connectionTypesApi
      .create({ key, label, group: this.newTypeGroup, color: this.newTypeColor })
      .subscribe(() => {
        this.newTypeKey = '';
        this.newTypeLabel = '';
        this.connectionTypes.reload();
      });
  }

  protected async removeConnectionType(type: ConnectionTypeDto): Promise<void> {
    const confirmed = await this.confirm.ask(`Delete connection type "${type.label}"?`, {
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;
    this.connectionTypesApi.remove(type.id).subscribe(() => this.connectionTypes.reload());
  }
}
