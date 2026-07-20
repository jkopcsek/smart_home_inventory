import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  mdiCog,
  mdiDevices,
  mdiFloorPlan,
  mdiTransitConnectionVariant,
} from '@mdi/js';
import { IconComponent } from './shared/ui/icon.component';
import { ToastOutletComponent } from './core/toast/toast-outlet.component';
import { ConfirmDialogComponent } from './core/confirm/confirm-dialog.component';

@Component({
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    IconComponent,
    ToastOutletComponent,
    ConfirmDialogComponent,
  ],
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <span class="title">Smart Home Inventory</span>
      <nav>
        <a routerLink="/areas" routerLinkActive="active">
          <app-icon [path]="icons.areas" [size]="18" /> Areas
        </a>
        <a routerLink="/devices" routerLinkActive="active">
          <app-icon [path]="icons.devices" [size]="18" /> Devices
        </a>
        <a routerLink="/connections" routerLinkActive="active">
          <app-icon [path]="icons.connections" [size]="18" /> Connections
        </a>
        <a routerLink="/settings" routerLinkActive="active">
          <app-icon [path]="icons.settings" [size]="18" /> Settings
        </a>
      </nav>
    </header>
    <main>
      <router-outlet />
    </main>
    <app-toast-outlet />
    <app-confirm-dialog />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    header {
      display: flex;
      align-items: center;
      gap: 24px;
      background: var(--app-header-background-color);
      color: var(--app-header-text-color);
      padding: 0 16px;
      min-height: 56px;
      flex-wrap: wrap;
    }
    .title {
      font-size: 18px;
      font-weight: 400;
      white-space: nowrap;
    }
    nav {
      display: flex;
      gap: 4px;
      align-self: stretch;
      flex-wrap: wrap;
    }
    nav a {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--app-header-text-color);
      opacity: 0.75;
      padding: 0 12px;
      border-bottom: 3px solid transparent;
      text-decoration: none;
      font-weight: 500;
      font-size: 14px;
    }
    nav a:hover {
      opacity: 1;
      text-decoration: none;
    }
    nav a.active {
      opacity: 1;
      border-bottom-color: var(--app-header-text-color);
    }
    main {
      flex: 1;
      overflow: auto;
      padding: 24px 16px;
    }
    main > * {
      display: block;
      max-width: 1100px;
      margin: 0 auto;
    }
  `,
})
export class App {
  protected readonly icons = {
    areas: mdiFloorPlan,
    devices: mdiDevices,
    connections: mdiTransitConnectionVariant,
    settings: mdiCog,
  };
}
