import { Injectable, signal } from '@angular/core';

interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  resolve: (confirmed: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly current = signal<ConfirmRequest | null>(null);

  ask(
    message: string,
    opts: { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean } = {}
  ): Promise<boolean> {
    return new Promise((resolve) => {
      this.current.set({
        title: opts.title ?? 'Are you sure?',
        message,
        confirmLabel: opts.confirmLabel ?? 'Confirm',
        cancelLabel: opts.cancelLabel ?? 'Cancel',
        danger: opts.danger ?? true,
        resolve,
      });
    });
  }

  answer(confirmed: boolean): void {
    this.current()?.resolve(confirmed);
    this.current.set(null);
  }
}
