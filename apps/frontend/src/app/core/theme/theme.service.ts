import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

/**
 * Detects Home Assistant's active theme. Because Ingress content is served
 * from HA's own origin, HA's frontend writes `selectedTheme` into the same
 * localStorage we can read. That is a community-discovered convention, not a
 * stable API — read defensively and fall back to prefers-color-scheme.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>('light');
  private readonly media = window.matchMedia?.('(prefers-color-scheme: dark)');

  init(): void {
    this.apply(this.detect());
    this.media?.addEventListener?.('change', () => this.apply(this.detect()));
  }

  private detect(): ThemeMode {
    const fromHa = this.readHaTheme();
    if (fromHa) return fromHa;
    return this.media?.matches ? 'dark' : 'light';
  }

  private readHaTheme(): ThemeMode | null {
    try {
      const raw = localStorage.getItem('selectedTheme');
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'dark' in parsed) {
        const dark = (parsed as { dark: unknown }).dark;
        if (typeof dark === 'boolean') return dark ? 'dark' : 'light';
      }
      if (parsed === 'dark') return 'dark';
      if (parsed === 'light') return 'light';
      return null; // "auto" or unknown shape → fall back to media query
    } catch {
      return null;
    }
  }

  private apply(mode: ThemeMode): void {
    this.mode.set(mode);
    document.documentElement.setAttribute('data-theme', mode);
  }
}
