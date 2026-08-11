import { computed, inject, Injectable, signal } from '@angular/core';
import {
  CONNECTION_TYPE_GROUPS,
  ConnectionTypeDto,
  ConnectionTypeGroup,
  ConnectionTypeLookup,
} from '@smart-home-inventory/shared';
import { ConnectionTypesApi } from '../api/api.services';

export interface ConnectionTypeGroupView {
  group: ConnectionTypeGroup;
  label: string;
  types: ConnectionTypeDto[];
}

const GROUP_LABELS: Record<ConnectionTypeGroup, string> = {
  wired: 'Wired',
  wireless: 'Wireless',
  plumbing: 'Plumbing',
  ventilation: 'Ventilation',
  other: 'Other',
};

/**
 * Loads the (user-editable) list of connection types once and keeps it
 * cached — every diagram/connection UI that needs to show or pick a type
 * reads from here instead of a hardcoded list. Call reload() after
 * add/removing a type in Settings so every other open view picks it up.
 */
@Injectable({ providedIn: 'root' })
export class ConnectionTypesStore implements ConnectionTypeLookup {
  private readonly api = inject(ConnectionTypesApi);

  readonly types = signal<ConnectionTypeDto[]>([]);
  readonly byKey = computed(() => Object.fromEntries(this.types().map((t) => [t.key, t])));
  /** Grouped for pickers/filters (Wired, Wireless, Plumbing, Ventilation,
   *  Other) — a group with no types yet (nothing seeded, nothing added)
   *  is omitted. */
  readonly groups = computed<ConnectionTypeGroupView[]>(() =>
    CONNECTION_TYPE_GROUPS.map((group) => ({
      group,
      label: GROUP_LABELS[group],
      types: this.types().filter((t) => t.group === group),
    })).filter((g) => g.types.length > 0)
  );

  constructor() {
    this.reload();
  }

  reload(): void {
    this.api.list().subscribe((types) => this.types.set(types));
  }

  /** Falls back to the raw key so a type deleted out from under a still-
   *  referencing diagram/connection shows *something* instead of going blank. */
  label(key: string): string {
    return this.byKey()[key]?.label ?? key;
  }

  color(key: string): string | null {
    return this.byKey()[key]?.color ?? null;
  }

  dash(key: string): string | null {
    return this.byKey()[key]?.dash ?? null;
  }
}
