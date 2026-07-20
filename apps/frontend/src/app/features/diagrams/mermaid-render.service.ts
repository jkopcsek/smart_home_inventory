import { Injectable, inject } from '@angular/core';
import { ThemeService } from '../../core/theme/theme.service';
import type { Mermaid } from 'mermaid';

/**
 * Lazily loads the (large) mermaid bundle only when a diagram is first
 * rendered, and keeps its theme in sync with the app theme.
 */
@Injectable({ providedIn: 'root' })
export class MermaidRenderService {
  private readonly theme = inject(ThemeService);
  private mermaid: Mermaid | null = null;
  private initializedWith: 'dark' | 'default' | null = null;
  private renderCounter = 0;

  private async load(): Promise<Mermaid> {
    if (!this.mermaid) {
      const mod = await import('mermaid');
      this.mermaid = mod.default;
    }
    const wanted = this.theme.mode() === 'dark' ? 'dark' : 'default';
    if (this.initializedWith !== wanted) {
      this.mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: wanted,
      });
      this.initializedWith = wanted;
    }
    return this.mermaid;
  }

  /** Validates source; throws with a readable message when invalid. */
  async parse(source: string): Promise<void> {
    const mermaid = await this.load();
    await mermaid.parse(source);
  }

  /** Renders source to an SVG string. */
  async render(source: string): Promise<string> {
    const mermaid = await this.load();
    const id = `mmd-${++this.renderCounter}`;
    const { svg } = await mermaid.render(id, source);
    return svg;
  }
}
