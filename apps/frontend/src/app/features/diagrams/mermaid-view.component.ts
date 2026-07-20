import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MermaidRenderService } from './mermaid-render.service';

/**
 * Live mermaid preview. Keeps the last good SVG visible while the source is
 * temporarily invalid and shows the parser error inline.
 */
@Component({
  selector: 'app-mermaid-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error(); as err) {
      <div class="error">{{ err }}</div>
    }
    <div class="diagram" [innerHTML]="svg()"></div>
  `,
  styles: `
    .diagram {
      overflow: auto;
    }
    .diagram :where(svg) {
      max-width: 100%;
    }
    .error {
      color: var(--error-color);
      background: color-mix(in srgb, var(--error-color) 12%, transparent);
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 8px;
      font-family: monospace;
      font-size: 12px;
      white-space: pre-wrap;
    }
  `,
})
export class MermaidViewComponent {
  private readonly renderer = inject(MermaidRenderService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly source = input.required<string>();

  protected readonly svg = signal<SafeHtml | ''>('');
  protected readonly error = signal<string | null>(null);

  private generation = 0;
  private debounce: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const source = this.source();
      if (this.debounce) clearTimeout(this.debounce);
      this.debounce = setTimeout(() => this.render(source), 300);
    });
  }

  private async render(source: string): Promise<void> {
    if (!source.trim()) {
      this.svg.set('');
      this.error.set(null);
      return;
    }
    const gen = ++this.generation;
    try {
      const svg = await this.renderer.render(source);
      // A newer render may have finished while we awaited — never regress.
      if (gen !== this.generation) return;
      // Mermaid output under securityLevel:'strict' is sanitized by mermaid
      // itself; bypass Angular's sanitizer for this trusted SVG only.
      this.svg.set(this.sanitizer.bypassSecurityTrustHtml(svg));
      this.error.set(null);
    } catch (err) {
      if (gen !== this.generation) return;
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }
}
