import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
  ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, map, of } from 'rxjs';
import { AreaDto, FloorDto } from '@smart-home-inventory/shared';
import { AreasApi, FloorsApi } from '../../core/api/api.services';
import { ToastService } from '../../core/toast/toast.service';

@Component({
  selector: 'app-area-form-dialog',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg (cancel)="closed.emit()">
      <h3>{{ area() ? 'Edit area' : 'New area' }}</h3>
      <form (ngSubmit)="save()">
        <label class="field">
          <span>Name *</span>
          <input class="text" name="name" [(ngModel)]="name" required />
        </label>
        <label class="field">
          <span>Floor</span>
          <input
            class="text"
            name="floor"
            list="floor-options"
            [(ngModel)]="floorName"
            placeholder="e.g. EG, 1. OG"
          />
          <datalist id="floor-options">
            @for (f of floors(); track f.id) {
              <option [value]="f.name"></option>
            }
          </datalist>
        </label>
        <label class="field">
          <span>Notes</span>
          <textarea class="text" name="notes" rows="4" [(ngModel)]="notes"></textarea>
        </label>
        <div class="actions">
          <button type="button" class="btn secondary" (click)="closed.emit()">
            Cancel
          </button>
          <button type="submit" class="btn" [disabled]="!name.trim() || saving()">
            Save
          </button>
        </div>
      </form>
    </dialog>
  `,
  styles: `
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
  `,
})
export class AreaFormDialogComponent {
  private readonly api = inject(AreasApi);
  private readonly floorsApi = inject(FloorsApi);
  private readonly toast = inject(ToastService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  /** null = create; a dto = edit. Set open() to show. */
  readonly area = input<AreaDto | null>(null);
  readonly open = input(false);
  readonly closed = output<void>();
  readonly saved = output<AreaDto>();

  protected name = '';
  protected floorName = '';
  protected notes = '';
  protected readonly floors = signal<FloorDto[]>([]);
  protected readonly saving = signal(false);

  constructor() {
    effect(() => {
      const el = this.dlg().nativeElement;
      if (this.open()) {
        const area = this.area();
        this.name = area?.name ?? '';
        this.floorName = area?.floorName ?? '';
        this.notes = area?.notes ?? '';
        this.floorsApi.list().subscribe((floors) => this.floors.set(floors));
        if (!el.open) el.showModal();
      } else if (el.open) {
        el.close();
      }
    });
  }

  /** Resolves the typed floor name to an existing floor's id, creating one if it's new. */
  private resolveFloorId(): Observable<string | null> {
    const name = this.floorName.trim();
    if (!name) return of(null);
    const existing = this.floors().find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (existing) return of(existing.id);
    return this.floorsApi.create({ name }).pipe(map((f) => f.id));
  }

  protected save(): void {
    if (!this.name.trim()) return;
    this.saving.set(true);
    this.resolveFloorId().subscribe({
      next: (floorId) => {
        const dto = {
          name: this.name.trim(),
          floorId,
          notes: this.notes.trim() || null,
        };
        const area = this.area();
        const req = area ? this.api.update(area.id, dto) : this.api.create(dto);
        req.subscribe({
          next: (saved) => {
            this.saving.set(false);
            this.toast.success(area ? 'Area updated' : 'Area created');
            this.saved.emit(saved);
          },
          error: () => this.saving.set(false),
        });
      },
      error: () => this.saving.set(false),
    });
  }
}
