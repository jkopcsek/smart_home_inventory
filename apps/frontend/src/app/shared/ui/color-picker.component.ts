import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, signal, viewChild } from '@angular/core';

/** A curated, evenly-spread palette — not the full CSS/mdi color space,
 *  which would make picking a consistent color across many items tedious
 *  (the point of a fixed palette). Custom is still one click away for
 *  anything more specific (e.g. matching a real conductor color).
 *  Material Design's 400-level tones — softer/less saturated than the
 *  600-level shades typically used for accents, which read as too harsh
 *  side by side in a whole palette. */
export const COLOR_PALETTE: readonly string[] = [
  '#ef5350', // red
  '#ffa726', // orange
  '#ffca28', // amber
  '#66bb6a', // green
  '#26a69a', // teal
  '#42a5f5', // blue
  '#5c6bc0', // indigo
  '#ab47bc', // purple
  '#ec407a', // pink
  '#8d6e63', // brown
  '#78909c', // blue grey
  '#616161', // grey
];

/**
 * A color swatch button that opens a small palette dialog — replaces raw
 * `<input type="color">` fields wherever the same color is likely to be
 * applied to many items (node/border/header/edge color). Picking a palette
 * swatch is one click and closes the dialog; "Custom" stays available for
 * anything not in the palette without giving up the fast path.
 */
@Component({
  selector: 'app-color-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="swatch-trigger"
      [style.background]="value()"
      [disabled]="disabled()"
      [title]="value()"
      (click)="openDialog()"
    ></button>

    <dialog #dlg (cancel)="close()">
      <h3>Color</h3>
      <div class="palette">
        @for (c of palette; track c) {
          <button
            type="button"
            class="swatch"
            [style.background]="c"
            [class.active]="sameColor(c, value())"
            [title]="c"
            (click)="pick(c)"
          ></button>
        }
      </div>
      <label class="custom-row">
        <span>Custom</span>
        <input type="color" [value]="value()" (change)="pickFromInput($event)" />
      </label>
      <div class="actions">
        <button type="button" class="btn secondary" (click)="close()">Close</button>
      </div>
    </dialog>
  `,
  styles: `
    .swatch-trigger {
      width: 28px;
      height: 22px;
      padding: 0;
      border: 1px solid var(--divider-color);
      border-radius: 4px;
      cursor: pointer;
    }
    .swatch-trigger:disabled {
      cursor: default;
      opacity: 0.5;
    }
    .palette {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
      margin: 12px 0;
    }
    .swatch {
      width: 100%;
      aspect-ratio: 1;
      padding: 0;
      border: 2px solid transparent;
      border-radius: 6px;
      cursor: pointer;
      /* A dark swatch (e.g. near-black) would otherwise blend into the
       * dialog's own background with nothing to mark its edge. */
      box-shadow: inset 0 0 0 1px var(--divider-color);
    }
    .swatch.active {
      border-color: var(--accent-color);
    }
    .custom-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding-top: 12px;
      border-top: 1px solid var(--divider-color);
    }
    .custom-row input[type='color'] {
      width: 36px;
      height: 26px;
      padding: 0;
      border: none;
      background: none;
      cursor: pointer;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
  `,
})
export class ColorPickerComponent {
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  readonly value = input.required<string>();
  readonly disabled = input(false);
  readonly valueChange = output<string>();

  protected readonly palette = COLOR_PALETTE;
  private readonly wantOpen = signal(false);

  constructor() {
    effect(() => {
      const el = this.dlg().nativeElement;
      if (this.wantOpen()) {
        if (!el.open) el.showModal();
      } else if (el.open) {
        el.close();
      }
    });
  }

  protected openDialog(): void {
    if (!this.disabled()) this.wantOpen.set(true);
  }

  protected close(): void {
    this.wantOpen.set(false);
  }

  protected pick(color: string): void {
    this.valueChange.emit(color);
    this.close();
  }

  protected pickFromInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }

  /** Case-insensitive — a custom-picked color and a palette entry can be the
   *  same hue with different letter casing depending on where they came from. */
  protected sameColor(a: string, b: string): boolean {
    return a.toLowerCase() === b.toLowerCase();
  }
}
