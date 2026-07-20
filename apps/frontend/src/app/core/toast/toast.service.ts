import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  kind: 'info' | 'error' | 'success';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  info(message: string): void {
    this.push('info', message);
  }

  success(message: string): void {
    this.push('success', message);
  }

  error(message: string): void {
    this.push('error', message, 6000);
  }

  private push(kind: Toast['kind'], message: string, ttl = 3500): void {
    const toast: Toast = { id: this.nextId++, kind, message };
    this.toasts.update((list) => [...list, toast]);
    setTimeout(() => {
      this.toasts.update((list) => list.filter((t) => t.id !== toast.id));
    }, ttl);
  }
}
