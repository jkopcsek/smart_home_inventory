import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  provideRouter,
  withComponentInputBinding,
  withHashLocation,
} from '@angular/router';
import { appRoutes } from './app.routes';
import { apiBaseInterceptor, httpErrorInterceptor } from './core/api/interceptors';
import { ThemeService } from './core/theme/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // Hash routing: the app never needs to know its dynamic Ingress path.
    provideRouter(appRoutes, withHashLocation(), withComponentInputBinding()),
    provideHttpClient(
      withFetch(),
      withInterceptors([apiBaseInterceptor, httpErrorInterceptor])
    ),
    provideAppInitializer(() => {
      inject(ThemeService).init();
    }),
  ],
};
