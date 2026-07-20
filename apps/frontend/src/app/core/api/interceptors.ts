import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../toast/toast.service';

/**
 * Ingress safety net: the app is served under a dynamic per-install path
 * (/api/hassio_ingress/<token>/), so every request URL must stay relative to
 * document.baseURI (<base href="./">). Absolute-origin URLs ("/api/...")
 * would escape the Ingress prefix and 401.
 */
export const apiBaseInterceptor: HttpInterceptorFn = (req, next) => {
  if (/^https?:\/\//.test(req.url)) {
    return next(req);
  }
  const path = req.url.replace(/^\//, '');
  const resolved = new URL(path, document.baseURI).toString();
  return next(req.clone({ url: resolved }));
};

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const body = err.error as
        | { message?: string; issues?: { path: string; message: string }[] }
        | undefined;
      let message = body?.message ?? err.message;
      if (body?.issues?.length) {
        message += ': ' + body.issues.map((i) => `${i.path} ${i.message}`).join(', ');
      }
      toast.error(message);
      return throwError(() => err);
    })
  );
};
