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
      align-items: stretch;
      background: var(--app-header-background-color);
      color: var(--app-header-text-color);
      border-bottom: 1px solid var(--divider-color);
      min-height: 56px;
      overflow: hidden;
    }
    nav {
      display: flex;
      overflow-x: auto;
      scrollbar-width: none;
    }
    nav::-webkit-scrollbar {
      display: none;
    }
    nav a {
      display: inline-flex;
      align-items: center;
      flex: 0 0 auto;
      gap: 6px;
      color: var(--secondary-text-color);
      padding: 0 16px;
      border-bottom: 3px solid transparent;
      text-decoration: none;
      white-space: nowrap;
      font-weight: 500;
      font-size: 14px;
    }
    nav a:hover {
      color: var(--primary-text-color);
      text-decoration: none;
    }
    nav a.active {
      color: var(--primary-color);
      border-bottom-color: var(--primary-color);
    }
    @media (max-width: 480px) {
      nav a {
        padding: 0 10px;
        font-size: 13px;
      }
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
    /* The diagram editor wants the full viewport below the nav bar — no
       padding, no content-width cap (see diagrams-page.component.ts). */
    main:has(app-diagrams-page) {
      padding: 0;
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
