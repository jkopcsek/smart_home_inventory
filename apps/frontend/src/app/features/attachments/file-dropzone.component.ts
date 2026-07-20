import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { mdiCloudUploadOutline } from '@mdi/js';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'app-file-dropzone',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="dropzone"
      [class.over]="dragOver()"
      (dragover)="$event.preventDefault(); dragOver.set(true)"
      (dragleave)="dragOver.set(false)"
      (drop)="onDrop($event)"
      (click)="fileInput.click()"
      (keydown.enter)="fileInput.click()"
      tabindex="0"
      role="button"
    >
      <app-icon [path]="uploadIcon" [size]="28" />
      <span>{{ label() }}</span>
      @if (progress() !== null) {
        <div class="bar">
          <div class="fill" [style.width.%]="progress()"></div>
        </div>
      }
      <input
        #fileInput
        type="file"
        [accept]="accept()"
        [multiple]="multiple()"
        hidden
        (change)="onPick($event)"
      />
    </div>
  `,
  styles: `
    .dropzone {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      border: 2px dashed var(--divider-color);
      border-radius: var(--ha-card-border-radius);
      color: var(--secondary-text-color);
      padding: 20px;
      cursor: pointer;
      transition: border-color 0.15s;
    }
    .dropzone.over,
    .dropzone:hover {
      border-color: var(--primary-color);
      color: var(--primary-color);
    }
    .bar {
      width: 100%;
      height: 4px;
      background: var(--divider-color);
      border-radius: 2px;
      overflow: hidden;
    }
    .fill {
      height: 100%;
      background: var(--primary-color);
      transition: width 0.2s;
    }
  `,
})
export class FileDropzoneComponent {
  readonly label = input('Drop a file here or click to select');
  readonly accept = input('*/*');
  readonly multiple = input(false);
  /** Upload progress 0–100 shown as a bar; null hides it. */
  readonly progress = input<number | null>(null);
  readonly files = output<File[]>();

  protected readonly dragOver = signal(false);
  protected readonly uploadIcon = mdiCloudUploadOutline;

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) this.files.emit(this.multiple() ? files : files.slice(0, 1));
  }

  protected onPick(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const files = Array.from(inputEl.files ?? []);
    if (files.length) this.files.emit(files);
    inputEl.value = '';
  }
}
