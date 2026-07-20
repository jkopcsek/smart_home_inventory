import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  AnnotationItem,
  AreaImageDto,
  DeviceDto,
  LabelAnnotation,
  PinAnnotation,
  PolylineAnnotation,
  RectAnnotation,
} from '@smart-home-inventory/shared';
import {
  mdiArrowLeft,
  mdiContentSave,
  mdiCursorDefaultOutline,
  mdiDelete,
  mdiFormatText,
  mdiHandBackRightOutline,
  mdiMagnifyExpand,
  mdiMapMarker,
  mdiRectangleOutline,
  mdiVectorPolyline,
} from '@mdi/js';
import { AreaImagesApi, attachmentUrl, DevicesApi } from '../../core/api/api.services';
import { ToastService } from '../../core/toast/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { DevicePickerComponent } from '../../shared/ui/device-picker.component';
import {
  clamp01,
  newId,
  screenToImage,
  ViewBox,
  viewScale,
  zoomAbout,
} from './editor-math';

type Tool = 'select' | 'pan' | 'pin' | 'polyline' | 'rect' | 'label';

interface DragState {
  id: string;
  startImage: { x: number; y: number };
  original: AnnotationItem;
}

@Component({
  selector: 'app-area-image-page',
  imports: [FormsModule, RouterLink, IconComponent, DevicePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (image(); as img) {
      <div class="header">
        <a class="btn icon-only" [routerLink]="['/areas', areaId()]" title="Back to area">
          <app-icon [path]="icons.back" />
        </a>
        <div class="titles">
          <h2>{{ img.name }}</h2>
          @if (img.description) {
            <span class="muted">{{ img.description }}</span>
          }
        </div>
        <span class="muted dirty">{{ dirty() ? 'unsaved changes' : '' }}</span>
        <button class="btn" [disabled]="!dirty() || saving()" (click)="save()">
          <app-icon [path]="icons.save" [size]="18" /> Save
        </button>
      </div>

      <div class="editor">
        <div class="toolbar card">
          @for (t of tools; track t.id) {
            <button
              class="btn icon-only tool"
              [class.active]="tool() === t.id"
              [title]="t.title"
              (click)="setTool(t.id)"
            >
              <app-icon [path]="t.icon" />
            </button>
          }
          <div class="spacer"></div>
          <button class="btn icon-only tool" title="Zoom to fit" (click)="zoomFit()">
            <app-icon [path]="icons.fit" />
          </button>
          <button
            class="btn icon-only tool"
            title="Delete selection (Del)"
            [disabled]="!selected()"
            (click)="deleteSelection()"
          >
            <app-icon [path]="icons.delete" />
          </button>
        </div>

        <div class="canvas-wrap card" #wrap tabindex="0" (keydown)="onKey($event)">
          <svg
            #svg
            [attr.viewBox]="viewBoxAttr()"
            preserveAspectRatio="xMidYMid meet"
            [class]="'tool-' + tool()"
            (pointerdown)="onPointerDown($event)"
            (pointermove)="onPointerMove($event)"
            (pointerup)="onPointerUp()"
            (dblclick)="onDblClick()"
            (wheel)="onWheel($event)"
          >
            @if (imageHref(); as href) {
              <image
                [attr.href]="href"
                x="0"
                y="0"
                [attr.width]="imgW()"
                [attr.height]="imgH()"
              />
            }

            <!-- annotations -->
            @for (a of annotations(); track a.id) {
              @switch (a.kind) {
                @case ('rect') {
                  <rect
                    [attr.x]="$any(a).x * imgW()"
                    [attr.y]="$any(a).y * imgH()"
                    [attr.width]="$any(a).w * imgW()"
                    [attr.height]="$any(a).h * imgH()"
                    [attr.stroke]="a.color ?? '#03a9f4'"
                    [attr.stroke-width]="2 / scale()"
                    fill="transparent"
                    class="shape"
                    [class.selected]="selected()?.id === a.id"
                    (pointerdown)="onShapeDown($event, a)"
                  />
                  @if ($any(a).label) {
                    <text
                      [attr.x]="$any(a).x * imgW() + 4 / scale()"
                      [attr.y]="$any(a).y * imgH() - 5 / scale()"
                      [attr.font-size]="13 / scale()"
                      [attr.fill]="a.color ?? '#03a9f4'"
                    >
                      {{ $any(a).label }}
                    </text>
                  }
                }
                @case ('polyline') {
                  <polyline
                    [attr.points]="polyPoints($any(a))"
                    [attr.stroke]="a.color ?? '#ff9800'"
                    [attr.stroke-width]="3 / scale()"
                    fill="none"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="shape"
                    [class.selected]="selected()?.id === a.id"
                    (pointerdown)="onShapeDown($event, a)"
                  />
                }
                @case ('pin') {
                  <g
                    class="shape pin"
                    [class.selected]="selected()?.id === a.id"
                    (pointerdown)="onShapeDown($event, a)"
                  >
                    <circle
                      [attr.cx]="$any(a).x * imgW()"
                      [attr.cy]="$any(a).y * imgH()"
                      [attr.r]="9 / scale()"
                      [attr.fill]="a.color ?? '#03a9f4'"
                      [attr.stroke-width]="2 / scale()"
                      stroke="white"
                    />
                    @if (pinText(a); as label) {
                      <text
                        [attr.x]="$any(a).x * imgW() + 13 / scale()"
                        [attr.y]="$any(a).y * imgH() + 4 / scale()"
                        [attr.font-size]="13 / scale()"
                        class="pin-label"
                      >
                        {{ label }}
                      </text>
                    }
                  </g>
                }
                @case ('label') {
                  <text
                    [attr.x]="$any(a).x * imgW()"
                    [attr.y]="$any(a).y * imgH()"
                    [attr.font-size]="($any(a).fontSize ?? 16) / scale()"
                    [attr.fill]="a.color ?? '#e53935'"
                    class="shape free-label"
                    [class.selected]="selected()?.id === a.id"
                    (pointerdown)="onShapeDown($event, a)"
                  >
                    {{ $any(a).text }}
                  </text>
                }
              }
            }

            <!-- polyline draft -->
            @if (draftPoints().length > 0) {
              <polyline
                [attr.points]="draftPolyAttr()"
                stroke="#ff9800"
                [attr.stroke-width]="3 / scale()"
                stroke-dasharray="6 4"
                fill="none"
              />
            }
            <!-- rect draft -->
            @if (draftRect(); as r) {
              <rect
                [attr.x]="r.x"
                [attr.y]="r.y"
                [attr.width]="r.w"
                [attr.height]="r.h"
                stroke="#03a9f4"
                [attr.stroke-width]="2 / scale()"
                stroke-dasharray="6 4"
                fill="transparent"
              />
            }
          </svg>
          @if (tool() === 'polyline') {
            <div class="hint">Click to add points · double-click to finish · Esc to cancel</div>
          }
        </div>

        <div class="props card">
          @if (selected(); as sel) {
            <h3>{{ sel.kind }}</h3>
            @if (sel.kind === 'pin') {
              <label class="field">
                <span>Label</span>
                <input
                  class="text"
                  [ngModel]="$any(sel).label ?? ''"
                  (ngModelChange)="patchSelected({ label: $event || undefined })"
                />
              </label>
              <div class="field">
                <span>Linked device</span>
                @if (linkedDevice(); as device) {
                  <div class="linked">
                    <a [routerLink]="['/devices', device.id]">{{ device.name }}</a>
                    <button class="btn secondary" (click)="patchSelected({ deviceId: undefined })">
                      Unlink
                    </button>
                  </div>
                } @else {
                  <app-device-picker (selected)="linkDevice($event)" />
                }
              </div>
              <div class="field">
                <span>Linked image</span>
                @if (linkedImage(); as target) {
                  <div class="linked">
                    <a [routerLink]="['/areas', areaId(), 'images', target.id]">
                      {{ target.name }}
                    </a>
                    <button
                      class="btn secondary"
                      (click)="patchSelected({ areaImageId: undefined })"
                    >
                      Unlink
                    </button>
                  </div>
                } @else if (siblingImages().length > 0) {
                  <select
                    class="text"
                    (change)="linkImage($any($event.target).value)"
                  >
                    <option value="">choose an image…</option>
                    @for (img of siblingImages(); track img.id) {
                      <option [value]="img.id">
                        {{ img.name }}{{ img.kind ? ' (' + img.kind + ')' : '' }}
                      </option>
                    }
                  </select>
                } @else {
                  <span class="muted">no other images in this area yet</span>
                }
              </div>
            }
            @if (sel.kind === 'rect') {
              <label class="field">
                <span>Label</span>
                <input
                  class="text"
                  [ngModel]="$any(sel).label ?? ''"
                  (ngModelChange)="patchSelected({ label: $event || undefined })"
                />
              </label>
            }
            @if (sel.kind === 'label') {
              <label class="field">
                <span>Text</span>
                <input
                  class="text"
                  [ngModel]="$any(sel).text"
                  (ngModelChange)="patchSelected({ text: $event || 'Text' })"
                />
              </label>
            }
            <label class="field">
              <span>Color</span>
              <input
                type="color"
                [ngModel]="sel.color ?? defaultColor(sel)"
                (ngModelChange)="patchSelected({ color: $event })"
              />
            </label>
            <button class="btn danger" (click)="deleteSelection()">
              <app-icon [path]="icons.delete" [size]="18" /> Delete
            </button>
          } @else {
            <p class="muted">
              Select an annotation, or use the toolbar to add pins (devices,
              junction boxes), cable runs, boxes and labels.
            </p>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .titles {
      flex: 1;
    }
    .titles h2 {
      margin: 0;
    }
    .dirty {
      font-style: italic;
    }
    .editor {
      display: grid;
      grid-template-columns: 56px 1fr 260px;
      gap: 12px;
      align-items: start;
    }
    .toolbar {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px;
      align-items: center;
    }
    .tool.active {
      background: color-mix(in srgb, var(--primary-color) 20%, transparent);
      color: var(--primary-color);
    }
    .spacer {
      height: 12px;
    }
    .canvas-wrap {
      padding: 0;
      overflow: hidden;
      position: relative;
      outline: none;
    }
    svg {
      display: block;
      width: 100%;
      height: min(70vh, 640px);
      touch-action: none;
      background: var(--secondary-background-color);
    }
    svg.tool-pan {
      cursor: grab;
    }
    svg.tool-pin,
    svg.tool-label {
      cursor: crosshair;
    }
    svg.tool-polyline,
    svg.tool-rect {
      cursor: crosshair;
    }
    .shape {
      cursor: pointer;
    }
    .shape.selected {
      filter: drop-shadow(0 0 4px var(--primary-color));
    }
    .pin-label {
      fill: var(--primary-text-color);
      paint-order: stroke;
      stroke: var(--card-background-color);
      stroke-width: 3px;
    }
    .hint {
      position: absolute;
      bottom: 8px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.6);
      color: #fff;
      border-radius: 6px;
      padding: 4px 12px;
      font-size: 12px;
      pointer-events: none;
    }
    .props h3 {
      text-transform: capitalize;
    }
    .linked {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    input[type='color'] {
      width: 48px;
      height: 32px;
      border: none;
      background: none;
      padding: 0;
      cursor: pointer;
    }
    @media (max-width: 900px) {
      .editor {
        grid-template-columns: 48px 1fr;
      }
      .props {
        grid-column: 1 / -1;
      }
    }
  `,
})
export class AreaImagePageComponent implements OnInit {
  private readonly api = inject(AreaImagesApi);
  private readonly devicesApi = inject(DevicesApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly areaId = input.required<string>();
  readonly imageId = input.required<string>();

  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');

  protected readonly image = signal<AreaImageDto | null>(null);
  protected readonly annotations = signal<AnnotationItem[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly tool = signal<Tool>('select');
  protected readonly dirty = signal(false);
  protected readonly saving = signal(false);
  protected readonly devices = signal<DeviceDto[]>([]);
  /** Other images of the same area — targets for image-link pins. */
  protected readonly siblingImages = signal<AreaImageDto[]>([]);

  protected readonly viewBox = signal<ViewBox>({ x: 0, y: 0, w: 1000, h: 750 });
  private readonly elementSize = signal({ width: 800, height: 600 });

  protected readonly draftPoints = signal<{ x: number; y: number }[]>([]);
  protected readonly draftRect = signal<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  private rectStart: { x: number; y: number } | null = null;
  private drag: DragState | null = null;
  private panStart: { x: number; y: number; vb: ViewBox } | null = null;
  private version = 1;

  protected readonly imgW = computed(() => this.image()?.imageWidth ?? 1000);
  protected readonly imgH = computed(() => this.image()?.imageHeight ?? 750);
  protected readonly imageHref = computed(() => {
    const att = this.image()?.imageAttachmentId;
    return att ? attachmentUrl(att, true) : null;
  });
  protected readonly viewBoxAttr = computed(() => {
    const vb = this.viewBox();
    return `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;
  });
  protected readonly scale = computed(() => {
    const size = this.elementSize();
    const vb = this.viewBox();
    return viewScale(new DOMRect(0, 0, size.width, size.height), vb);
  });
  protected readonly selected = computed(
    () => this.annotations().find((a) => a.id === this.selectedId()) ?? null
  );
  protected readonly linkedDevice = computed(() => {
    const sel = this.selected();
    if (!sel || sel.kind !== 'pin' || !sel.deviceId) return null;
    return this.devices().find((d) => d.id === sel.deviceId) ?? null;
  });
  protected readonly linkedImage = computed(() => {
    const sel = this.selected();
    if (!sel || sel.kind !== 'pin' || !sel.areaImageId) return null;
    return this.siblingImages().find((i) => i.id === sel.areaImageId) ?? null;
  });

  protected readonly tools: { id: Tool; icon: string; title: string }[] = [
    { id: 'select', icon: mdiCursorDefaultOutline, title: 'Select / move' },
    { id: 'pan', icon: mdiHandBackRightOutline, title: 'Pan' },
    { id: 'pin', icon: mdiMapMarker, title: 'Device / marker pin' },
    { id: 'polyline', icon: mdiVectorPolyline, title: 'Cable run (polyline)' },
    { id: 'rect', icon: mdiRectangleOutline, title: 'Box / zone' },
    { id: 'label', icon: mdiFormatText, title: 'Text label' },
  ];

  protected readonly icons = {
    back: mdiArrowLeft,
    save: mdiContentSave,
    delete: mdiDelete,
    fit: mdiMagnifyExpand,
  };

  ngOnInit(): void {
    this.api.get(this.imageId()).subscribe((img) => {
      this.image.set(img);
      this.annotations.set(img.annotations.items);
      this.version = img.version;
      this.zoomFit();
    });
    this.devicesApi.list().subscribe((devices) => this.devices.set(devices));
    this.api
      .listForArea(this.areaId())
      .subscribe((images) =>
        this.siblingImages.set(images.filter((i) => i.id !== this.imageId()))
      );
    new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) this.elementSize.set({ width: rect.width, height: rect.height });
    }).observe(document.body);
  }

  // ---------- toolbar ----------

  protected setTool(tool: Tool): void {
    this.tool.set(tool);
    this.cancelDraft();
  }

  protected zoomFit(): void {
    this.viewBox.set({ x: 0, y: 0, w: this.imgW(), h: this.imgH() });
  }

  // ---------- pointer handling ----------

  private toImage(event: PointerEvent | WheelEvent): { x: number; y: number } {
    const rect = this.svg().nativeElement.getBoundingClientRect();
    this.elementSize.set({ width: rect.width, height: rect.height });
    return screenToImage(event.clientX, event.clientY, rect, this.viewBox());
  }

  protected onShapeDown(event: PointerEvent, annotation: AnnotationItem): void {
    if (this.tool() !== 'select') return;
    event.stopPropagation();
    this.selectedId.set(annotation.id);
    const start = this.toImage(event);
    this.drag = {
      id: annotation.id,
      startImage: start,
      original: structuredClone(annotation),
    };
    (event.target as Element).setPointerCapture(event.pointerId);
  }

  protected onPointerDown(event: PointerEvent): void {
    const point = this.toImage(event);
    const norm = {
      x: clamp01(point.x / this.imgW()),
      y: clamp01(point.y / this.imgH()),
    };
    switch (this.tool()) {
      case 'pan':
        this.panStart = { x: event.clientX, y: event.clientY, vb: this.viewBox() };
        this.svg().nativeElement.setPointerCapture(event.pointerId);
        break;
      case 'select':
        this.selectedId.set(null);
        this.panStart = { x: event.clientX, y: event.clientY, vb: this.viewBox() };
        this.svg().nativeElement.setPointerCapture(event.pointerId);
        break;
      case 'pin': {
        const pin: PinAnnotation = { id: newId(), kind: 'pin', ...norm };
        this.addAnnotation(pin);
        this.tool.set('select');
        break;
      }
      case 'label': {
        const label: LabelAnnotation = {
          id: newId(),
          kind: 'label',
          ...norm,
          text: 'Text',
        };
        this.addAnnotation(label);
        this.tool.set('select');
        break;
      }
      case 'polyline':
        this.draftPoints.update((points) => [...points, norm]);
        break;
      case 'rect':
        this.rectStart = point;
        this.svg().nativeElement.setPointerCapture(event.pointerId);
        break;
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.drag) {
      const point = this.toImage(event);
      const dx = (point.x - this.drag.startImage.x) / this.imgW();
      const dy = (point.y - this.drag.startImage.y) / this.imgH();
      this.moveAnnotation(this.drag.original, dx, dy);
      return;
    }
    if (this.panStart) {
      const rect = this.svg().nativeElement.getBoundingClientRect();
      const scale = viewScale(rect, this.panStart.vb);
      this.viewBox.set({
        ...this.panStart.vb,
        x: this.panStart.vb.x - (event.clientX - this.panStart.x) / scale,
        y: this.panStart.vb.y - (event.clientY - this.panStart.y) / scale,
      });
      return;
    }
    if (this.rectStart) {
      const point = this.toImage(event);
      this.draftRect.set({
        x: Math.min(this.rectStart.x, point.x),
        y: Math.min(this.rectStart.y, point.y),
        w: Math.abs(point.x - this.rectStart.x),
        h: Math.abs(point.y - this.rectStart.y),
      });
    }
  }

  protected onPointerUp(): void {
    if (this.drag) {
      this.drag = null;
      this.markDirty();
    }
    this.panStart = null;
    if (this.rectStart) {
      const draft = this.draftRect();
      this.rectStart = null;
      this.draftRect.set(null);
      if (draft && draft.w > 4 && draft.h > 4) {
        const rect: RectAnnotation = {
          id: newId(),
          kind: 'rect',
          x: clamp01(draft.x / this.imgW()),
          y: clamp01(draft.y / this.imgH()),
          w: clamp01(draft.w / this.imgW()),
          h: clamp01(draft.h / this.imgH()),
        };
        this.addAnnotation(rect);
        this.tool.set('select');
      }
    }
  }

  protected onDblClick(): void {
    if (this.tool() === 'polyline' && this.draftPoints().length >= 2) {
      // The double-click added the last point twice — drop one.
      const points = this.draftPoints().slice(0, -1);
      if (points.length >= 2) {
        const polyline: PolylineAnnotation = {
          id: newId(),
          kind: 'polyline',
          points,
        };
        this.addAnnotation(polyline);
      }
      this.draftPoints.set([]);
      this.tool.set('select');
    }
  }

  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    const point = this.toImage(event);
    const factor = event.deltaY > 0 ? 1.15 : 1 / 1.15;
    this.viewBox.set(
      zoomAbout(this.viewBox(), point, factor, {
        minW: this.imgW() / 20,
        maxW: this.imgW() * 4,
      })
    );
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.cancelDraft();
      this.selectedId.set(null);
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && this.selected()) {
      event.preventDefault();
      this.deleteSelection();
    }
  }

  // ---------- annotation ops ----------

  private addAnnotation(annotation: AnnotationItem): void {
    this.annotations.update((items) => [...items, annotation]);
    this.selectedId.set(annotation.id);
    this.markDirty();
  }

  private moveAnnotation(original: AnnotationItem, dx: number, dy: number): void {
    this.annotations.update((items) =>
      items.map((a) => {
        if (a.id !== original.id) return a;
        if (original.kind === 'polyline') {
          return {
            ...original,
            points: original.points.map((p) => ({
              x: clamp01(p.x + dx),
              y: clamp01(p.y + dy),
            })),
          };
        }
        return {
          ...original,
          x: clamp01((original as PinAnnotation).x + dx),
          y: clamp01((original as PinAnnotation).y + dy),
        } as AnnotationItem;
      })
    );
  }

  protected patchSelected(patch: Partial<AnnotationItem>): void {
    const id = this.selectedId();
    if (!id) return;
    this.annotations.update((items) =>
      items.map((a) => (a.id === id ? ({ ...a, ...patch } as AnnotationItem) : a))
    );
    this.markDirty();
  }

  protected linkDevice(device: DeviceDto): void {
    this.patchSelected({ deviceId: device.id });
  }

  protected linkImage(areaImageId: string): void {
    if (areaImageId) this.patchSelected({ areaImageId });
  }

  protected deleteSelection(): void {
    const id = this.selectedId();
    if (!id) return;
    this.annotations.update((items) => items.filter((a) => a.id !== id));
    this.selectedId.set(null);
    this.markDirty();
  }

  private cancelDraft(): void {
    this.draftPoints.set([]);
    this.draftRect.set(null);
    this.rectStart = null;
  }

  private markDirty(): void {
    this.dirty.set(true);
  }

  // ---------- rendering helpers ----------

  protected polyPoints(a: PolylineAnnotation): string {
    return a.points.map((p) => `${p.x * this.imgW()},${p.y * this.imgH()}`).join(' ');
  }

  protected draftPolyAttr(): string {
    return this.draftPoints()
      .map((p) => `${p.x * this.imgW()},${p.y * this.imgH()}`)
      .join(' ');
  }

  protected pinText(a: AnnotationItem): string | null {
    if (a.kind !== 'pin') return null;
    if (a.label) return a.label;
    if (a.deviceId) {
      return this.devices().find((d) => d.id === a.deviceId)?.name ?? null;
    }
    if (a.areaImageId) {
      const target = this.siblingImages().find((i) => i.id === a.areaImageId);
      return target ? `→ ${target.name}` : null;
    }
    return null;
  }

  protected defaultColor(a: AnnotationItem): string {
    switch (a.kind) {
      case 'polyline':
        return '#ff9800';
      case 'label':
        return '#e53935';
      default:
        return '#03a9f4';
    }
  }

  // ---------- persistence ----------

  protected save(): void {
    const image = this.image();
    if (!image) return;
    this.saving.set(true);
    this.api
      .putAnnotations(image.id, this.version, {
        version: 1,
        items: this.annotations(),
      })
      .subscribe({
        next: (updated) => {
          this.version = updated.version;
          this.saving.set(false);
          this.dirty.set(false);
          this.toast.success('Annotations saved');
        },
        error: (err) => {
          this.saving.set(false);
          if (err?.status === 409) {
            this.toast.error(
              'Annotations were changed elsewhere — reload the page to get the latest version.'
            );
          }
        },
      });
  }
}
