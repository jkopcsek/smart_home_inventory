import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'areas' },
  {
    path: 'areas',
    loadComponent: () =>
      import('./features/areas/area-list-page.component').then(
        (m) => m.AreaListPageComponent
      ),
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./features/home/home-detail-page.component').then(
        (m) => m.HomeDetailPageComponent
      ),
  },
  {
    path: 'areas/:areaId',
    loadComponent: () =>
      import('./features/areas/area-detail-page.component').then(
        (m) => m.AreaDetailPageComponent
      ),
  },
  {
    path: 'devices',
    loadComponent: () =>
      import('./features/devices/device-list-page.component').then(
        (m) => m.DeviceListPageComponent
      ),
  },
  {
    path: 'devices/new',
    loadComponent: () =>
      import('./features/devices/device-form-page.component').then(
        (m) => m.DeviceFormPageComponent
      ),
  },
  {
    path: 'devices/:deviceId',
    loadComponent: () =>
      import('./features/devices/device-detail-page.component').then(
        (m) => m.DeviceDetailPageComponent
      ),
  },
  {
    path: 'devices/:deviceId/edit',
    loadComponent: () =>
      import('./features/devices/device-form-page.component').then(
        (m) => m.DeviceFormPageComponent
      ),
  },
  {
    path: 'connections',
    loadComponent: () =>
      import('./features/connections/connections-page.component').then(
        (m) => m.ConnectionsPageComponent
      ),
  },
  {
    path: 'diagrams',
    loadComponent: () =>
      import('./features/diagrams/diagrams-page.component').then(
        (m) => m.DiagramsPageComponent
      ),
  },
  {
    path: 'attachments/:attachmentId',
    loadComponent: () =>
      import('./features/attachments/attachment-view-page.component').then(
        (m) => m.AttachmentViewPageComponent
      ),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings-page.component').then(
        (m) => m.SettingsPageComponent
      ),
  },
  { path: '**', redirectTo: 'areas' },
];
