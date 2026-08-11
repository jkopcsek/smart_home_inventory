import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../../../shared/ui/icon.component';
import { NODE_ICONS, NodeIconOption } from '../nodes/node-icons';

/**
 * A filterable icon grid, replacing a plain `<select>` — NODE_ICONS is long
 * enough (and each entry only distinguishable by a small glyph) that a
 * dropdown of text labels made picking the right one slower than it needed
 * to be. "None" is always the first option, same spot the old `<select>`'s
 * empty option held.
 */
@Component({
  selector: 'app-icon-picker-dialog',
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg (cancel)="closed.emit()">
      <h3>Icon</h3>
      <input
        class="text filter"
        type="text"
        placeholder="Filter…"
        [(ngModel)]="filter"
        #filterInput
      />
      <div class="grid">
        <button type="button" class="option none" [class.active]="!current()" (click)="pick(undefined)">
          <span class="none-glyph">—</span>
          <span class="label">None</span>
        </button>
        @for (opt of filtered(); track opt.key) {
          <button type="button" class="option" [class.active]="current() === opt.key" (click)="pick(opt.key)">
            <app-icon [path]="opt.path" [size]="22" />
            <span class="label">{{ opt.label }}</span>
          </button>
        }
      </div>
      @if (filtered().length === 0) {
        <p class="empty">No icons match "{{ filter() }}".</p>
      }
      <div class="actions">
        <button type="button" class="btn secondary" (click)="closed.emit()">Cancel</button>
      </div>
    </dialog>
  `,
  styles: `
    .filter {
      width: 100%;
      box-sizing: border-box;
      margin-bottom: 12px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
      gap: 6px;
      max-height: min(50vh, 360px);
      overflow: auto;
    }
    .option {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 10px 4px;
      border: 1px solid transparent;
      border-radius: 6px;
      background: none;
      color: inherit;
      cursor: pointer;
    }
    .option:hover {
      background: var(--hover-color);
    }
    .option.active {
      border-color: var(--accent-color);
      background: var(--hover-color);
    }
    .none-glyph {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      color: var(--secondary-text-color);
    }
    .label {
      font-size: 11px;
      text-align: center;
      line-height: 1.2;
      color: var(--secondary-text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    .empty {
      color: var(--secondary-text-color);
      font-size: 13px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
  `,
})
export class IconPickerDialogComponent {
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private readonly filterInput = viewChild<ElementRef<HTMLInputElement>>('filterInput');

  readonly open = input(false);
  /** The currently-set icon key, if any — highlights the matching option. */
  readonly current = input<string | undefined>(undefined);
  readonly closed = output<void>();
  readonly picked = output<string | undefined>();

  protected readonly filter = signal('');
  protected readonly filtered = computed<NodeIconOption[]>(() => {
    const term = this.filter().trim().toLowerCase();
    if (!term) return NODE_ICONS;
    return NODE_ICONS.filter((opt) => opt.label.toLowerCase().includes(term));
  });

  constructor() {
    effect(() => {
      const el = this.dlg().nativeElement;
      if (this.open()) {
        if (!el.open) {
          el.showModal();
          this.filter.set('');
          queueMicrotask(() => this.filterInput()?.nativeElement.focus());
        }
      } else if (el.open) {
        el.close();
      }
    });
  }

  protected pick(key: string | undefined): void {
    this.picked.emit(key);
  }
}
