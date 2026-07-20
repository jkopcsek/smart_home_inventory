import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  Injector,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  Edge as NgEdge,
  EdgeDrawEndedEvent,
  initializeModel,
  ModelAdapter,
  NgDiagramBackgroundComponent,
  NgDiagramComponent,
  NgDiagramMinimapComponent,
  NgDiagramModelService,
  NgDiagramNodeService,
  NgDiagramNodeTemplateMap,
  NgDiagramSelectionService,
  NgDiagramViewportService,
  Node as NgNode,
  provideNgDiagram,
  SelectionChangedEvent,
} from 'ng-diagram';
import {
  AttachmentDto,
  BoxPortsNodeData,
  ConnectionDto,
  DeviceDto,
  DiagramContent,
  DiagramDto,
  DiagramNode,
  EdgeData,
  NodeData,
  NodePort,
  PortDirection,
} from '@smart-home-inventory/shared';
import { attachmentUrl, AttachmentsApi, ConnectionsApi, DiagramsApi } from '../../core/api/api.services';
import { ToastService } from '../../core/toast/toast.service';
import { ConfirmService } from '../../core/confirm/confirm.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { DevicePickerComponent } from '../../shared/ui/device-picker.component';
import { DotNodeComponent } from './nodes/dot-node.component';
import { BoxNodeComponent } from './nodes/box-node.component';
import { BoxPortsNodeComponent } from './nodes/box-ports-node.component';
import { AttachmentPickerDialogComponent } from './pickers/attachment-picker-dialog.component';
import { DiagramLinkPickerDialogComponent } from './pickers/diagram-link-picker-dialog.component';
import { ConnectionPickerDialogComponent } from './pickers/connection-picker-dialog.component';
import {
  mdiChevronDown,
  mdiChevronUp,
  mdiCircleOutline,
  mdiClose,
  mdiContentSave,
  mdiDelete,
  mdiDevices,
  mdiElectricSwitch,
  mdiImageOutline,
  mdiImagePlus,
  mdiLinkVariant,
  mdiLock,
  mdiLockOpenVariantOutline,
  mdiOpenInNew,
  mdiShapeOutline,
  mdiTune,
} from '@mdi/js';

type Shape = 'dot' | 'box' | 'box-ports';

type PickerTarget =
  | { kind: 'link-device'; nodeId: string }
  | { kind: 'link-diagram'; nodeId: string }
  | { kind: 'link-image'; nodeId: string }
  | { kind: 'set-diagram-background' }
  | { kind: 'edge-connection'; edgeId: string };

function toContent(nodes: NgNode[], edges: NgEdge[]): DiagramContent {
  return {
    schemaVersion: 1,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type as DiagramNode['type'],
      position: n.position,
      size: n.size,
      autoSize: n.autoSize,
      resizable: n.resizable,
      draggable: n.draggable,
      data: n.data as NodeData,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourcePort: e.sourcePort,
      targetPort: e.targetPort,
      data: (e.data ?? {}) as EdgeData,
    })),
  };
}

/**
 * The canvas owns the whole screen — toolbar, property editor, diagram
 * properties (title/background) and zoom controls are all floating overlays
 * on top of it, mirroring ng-diagram's own demos, rather than eating into
 * the canvas as a fixed toolbar row / side column.
 *
 * Node shape (Dot / Box / Box with ports) and what a node links to (a
 * Device, another Diagram, or an image Attachment) are orthogonal — any
 * shape can carry any link, rather than each combination being its own kind.
 */
@Component({
  selector: 'app-diagram-canvas',
  providers: [provideNgDiagram()],
  imports: [
    NgDiagramComponent,
    NgDiagramBackgroundComponent,
    NgDiagramMinimapComponent,
    IconComponent,
    DevicePickerComponent,
    AttachmentPickerDialogComponent,
    DiagramLinkPickerDialogComponent,
    ConnectionPickerDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="canvas-wrap">
      @if (model(); as m) {
        <ng-diagram
          [model]="m"
          [nodeTemplateMap]="nodeTemplateMap"
          (diagramInit)="onDiagramInit()"
          (selectionChanged)="onSelectionChanged($event)"
          (edgeDrawEnded)="onEdgeDrawEnded($event)"
        >
          <ng-diagram-background type="dots" />
        </ng-diagram>
        <ng-diagram-minimap position="bottom-right" [width]="180" [height]="130" [showZoomControls]="true" />
      }

      <div class="overlay toolbar-overlay card">
        <button
          class="btn icon-only"
          [class.active-toggle]="propertiesOpen()"
          title="Diagram properties"
          (click)="propertiesOpen.set(!propertiesOpen())"
        >
          <app-icon [path]="icons.properties" [size]="20" />
        </button>
        <div class="v-divider"></div>
        <button class="btn icon-only" title="Add dot marker" (click)="addNode('dot')">
          <app-icon [path]="icons.dot" [size]="20" />
        </button>
        <button class="btn icon-only" title="Add box" (click)="addNode('box')">
          <app-icon [path]="icons.shape" [size]="20" />
        </button>
        <button class="btn icon-only" title="Add box with ports" (click)="addNode('box-ports')">
          <app-icon [path]="icons.ports" [size]="20" />
        </button>
        <div class="v-divider"></div>
        <button
          class="btn icon-only"
          title="Delete selection"
          [disabled]="!selection()"
          (click)="deleteSelection()"
        >
          <app-icon [path]="icons.delete" [size]="20" />
        </button>
      </div>

      <div class="overlay save-overlay">
        @if (dirty()) {
          <span class="dirty-dot" title="Unsaved changes"></span>
        }
        <button class="btn" [disabled]="!dirty() || saving()" (click)="save()">
          <app-icon [path]="icons.save" [size]="18" /> Save
        </button>
      </div>

      @if (propertiesOpen()) {
        <div class="overlay panel properties-overlay card">
          <div class="panel-head">
            <h3>Diagram properties</h3>
            <button class="btn icon-only" (click)="propertiesOpen.set(false)">
              <app-icon [path]="icons.close" [size]="16" />
            </button>
          </div>
          <label class="field">
            <span>Title</span>
            <input class="text" [value]="title()" (change)="renameTitle($event)" />
          </label>
          <div class="field">
            <span>Background image</span>
            @if (backgroundImage(); as bg) {
              <img class="bg-preview" [src]="backgroundImageUrl(bg)" alt="" />
              <div class="row-buttons">
                <button class="btn secondary" (click)="openPicker({ kind: 'link-image', nodeId: bg.id })">
                  Replace
                </button>
                <button class="btn secondary" (click)="removeBackground(bg)">Remove</button>
              </div>
            } @else {
              <button
                class="btn secondary"
                [disabled]="!hasImageSource()"
                (click)="openPicker({ kind: 'set-diagram-background' })"
              >
                Set background image
              </button>
            }
          </div>
          <button class="btn danger" (click)="deleteDiagram()">
            <app-icon [path]="icons.delete" [size]="16" /> Delete diagram
          </button>
        </div>
      }

      @if (selection(); as sel) {
        <div class="overlay panel selection-overlay card">
          @if (sel.kind === 'node') {
            <h3>{{ sel.data.shape }}</h3>
            <label class="field">
              <span>Label</span>
              <input class="text" [value]="sel.data.label ?? ''" (change)="setNodeLabel(sel.id, sel.data, $event)" />
            </label>
            <label class="field">
              <span>Color</span>
              <input
                type="color"
                [value]="sel.data.color ?? '#03a9f4'"
                (change)="setNodeColor(sel.id, sel.data, $event)"
              />
            </label>

            <div class="shape-toggle">
              <button
                class="btn secondary"
                [class.active-toggle]="sel.data.shape === 'dot'"
                title="Dot marker"
                (click)="setShape(sel.id, 'dot', sel.data)"
              >
                <app-icon [path]="icons.dot" [size]="16" />
              </button>
              <button
                class="btn secondary"
                [class.active-toggle]="sel.data.shape === 'box'"
                title="Box"
                (click)="setShape(sel.id, 'box', sel.data)"
              >
                <app-icon [path]="icons.shape" [size]="16" />
              </button>
              <button
                class="btn secondary"
                [class.active-toggle]="sel.data.shape === 'box-ports'"
                title="Box with ports"
                (click)="setShape(sel.id, 'box-ports', sel.data)"
              >
                <app-icon [path]="icons.ports" [size]="16" />
              </button>
            </div>

            @if (sel.data.shape === 'box-ports') {
              <div class="ports-editor">
                <span class="ports-group-label">Inputs</span>
                @for (port of sel.data.ports; track port.id) {
                  @if (port.direction === 'in') {
                    <div class="port-edit-row">
                      <input
                        class="text"
                        placeholder="Label"
                        [value]="port.label"
                        (change)="updatePortLabel(sel.id, sel.data, port.id, $event)"
                      />
                      <button class="btn icon-only" title="Move up" (click)="movePort(sel.id, sel.data, port.id, -1)">
                        <app-icon [path]="icons.up" [size]="14" />
                      </button>
                      <button class="btn icon-only" title="Move down" (click)="movePort(sel.id, sel.data, port.id, 1)">
                        <app-icon [path]="icons.down" [size]="14" />
                      </button>
                      <button class="btn icon-only" title="Remove port" (click)="removePort(sel.id, sel.data, port.id)">
                        <app-icon [path]="icons.delete" [size]="14" />
                      </button>
                    </div>
                  }
                }
                <button class="btn secondary" (click)="addPort(sel.id, sel.data, 'in')">+ Input port</button>

                <span class="ports-group-label">Outputs</span>
                @for (port of sel.data.ports; track port.id) {
                  @if (port.direction === 'out') {
                    <div class="port-edit-row">
                      <input
                        class="text"
                        placeholder="Label"
                        [value]="port.label"
                        (change)="updatePortLabel(sel.id, sel.data, port.id, $event)"
                      />
                      <button class="btn icon-only" title="Move up" (click)="movePort(sel.id, sel.data, port.id, -1)">
                        <app-icon [path]="icons.up" [size]="14" />
                      </button>
                      <button class="btn icon-only" title="Move down" (click)="movePort(sel.id, sel.data, port.id, 1)">
                        <app-icon [path]="icons.down" [size]="14" />
                      </button>
                      <button class="btn icon-only" title="Remove port" (click)="removePort(sel.id, sel.data, port.id)">
                        <app-icon [path]="icons.delete" [size]="14" />
                      </button>
                    </div>
                  }
                }
                <button class="btn secondary" (click)="addPort(sel.id, sel.data, 'out')">+ Output port</button>
              </div>
            }

            <div class="link-section">
              @if (sel.data.link; as link) {
                @if (link.kind === 'device') {
                  <button class="btn secondary" (click)="openDevice(link.deviceId)">
                    <app-icon [path]="icons.open" [size]="16" /> Open device
                  </button>
                }
                @if (link.kind === 'diagram') {
                  <button class="btn secondary" (click)="openDiagram(link.diagramId)">
                    <app-icon [path]="icons.open" [size]="16" /> Open diagram
                  </button>
                }
                <button class="btn secondary" (click)="openPicker(pickerFor(link.kind, sel.id))">
                  Change {{ link.kind }} link
                </button>
                <button class="btn secondary" (click)="removeLink(sel.id, sel.data)">Remove link</button>
                @if (link.kind === 'image' && sel.data.shape === 'box' && !sel.data.background) {
                  <button class="btn secondary" (click)="useAsBackground(sel.id, sel.data)">
                    <app-icon [path]="icons.background" [size]="16" /> Use as background
                  </button>
                }
              } @else {
                <button class="btn secondary" (click)="openPicker({ kind: 'link-device', nodeId: sel.id })">
                  <app-icon [path]="icons.device" [size]="16" /> Link to device
                </button>
                <button class="btn secondary" (click)="openPicker({ kind: 'link-image', nodeId: sel.id })">
                  <app-icon [path]="icons.image" [size]="16" /> Link to image
                </button>
                @if (siblingDiagrams().length > 0) {
                  <button class="btn secondary" (click)="openPicker({ kind: 'link-diagram', nodeId: sel.id })">
                    <app-icon [path]="icons.link" [size]="16" /> Link to diagram
                  </button>
                }
              }
            </div>

            <button class="btn secondary" (click)="toggleLocked(sel.id, sel.locked)">
              <app-icon [path]="sel.locked ? icons.locked : icons.unlocked" [size]="16" />
              {{ sel.locked ? 'Locked — click to unlock' : 'Lock in place' }}
            </button>
          } @else {
            <h3>Connection</h3>
            <label class="field">
              <span>Label</span>
              <input class="text" [value]="sel.data.label ?? ''" (change)="setEdgeLabel(sel.id, $event)" />
            </label>
            @if (sel.data.connectionId) {
              <span class="muted">{{ connectionLabel(sel.data.connectionId) }}</span>
              <button class="btn secondary" (click)="openConnectionDevice(sel.data.connectionId)">
                <app-icon [path]="icons.open" [size]="16" /> Open connection
              </button>
            }
            @if (connections().length > 0) {
              <button class="btn secondary" (click)="openPicker({ kind: 'edge-connection', edgeId: sel.id })">
                {{ sel.data.connectionId ? 'Change connection' : 'Link to connection' }}
              </button>
            }
          }
        </div>
      }
    </div>

    <dialog #deviceDlg (cancel)="pickerTarget.set(null)">
      <h3>Pick a device</h3>
      <app-device-picker placeholder="Search device…" (selected)="onDevicePicked($event)" />
      <div class="actions">
        <button type="button" class="btn secondary" (click)="closeDeviceDialog()">Cancel</button>
      </div>
    </dialog>

    <app-attachment-picker-dialog
      [open]="
        pickerTarget()?.kind === 'link-image' || pickerTarget()?.kind === 'set-diagram-background'
      "
      [attachments]="imageAttachments()"
      (closed)="pickerTarget.set(null)"
      (picked)="onAttachmentPicked($event)"
    />
    <app-diagram-link-picker-dialog
      [open]="pickerTarget()?.kind === 'link-diagram'"
      [diagrams]="siblingDiagrams()"
      (closed)="pickerTarget.set(null)"
      (picked)="onDiagramLinkPicked($event)"
    />
    <app-connection-picker-dialog
      [open]="pickerTarget()?.kind === 'edge-connection'"
      [connections]="connections()"
      (closed)="pickerTarget.set(null)"
      (picked)="onConnectionPicked($event)"
    />
  `,
  styles: `
    :host {
      display: block;
    }
    .canvas-wrap {
      position: relative;
      /* A definite height, not min-height: percentage heights on children
         (ng-diagram, ng-diagram-minimap panels) only resolve against a
         definite parent height — min-height alone doesn't count. */
      height: calc(100vh - 160px);
      border-radius: var(--ha-card-border-radius);
      overflow: hidden;
      border: 1px solid var(--ha-card-border-color);
    }
    ng-diagram {
      width: 100%;
      height: 100%;
      display: flex;
    }
    .overlay {
      position: absolute;
      z-index: 10;
    }
    .toolbar-overlay {
      top: 12px;
      left: 12px;
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 4px;
    }
    .v-divider {
      width: 1px;
      height: 22px;
      background: var(--divider-color);
      margin: 0 4px;
    }
    .save-overlay {
      top: 12px;
      right: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dirty-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--warning-color);
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 260px;
      max-height: calc(100% - 24px);
      overflow: auto;
      padding: 14px;
    }
    .properties-overlay {
      top: 60px;
      left: 12px;
    }
    .selection-overlay {
      top: 60px;
      right: 12px;
    }
    .panel h3 {
      text-transform: capitalize;
      margin: 0;
    }
    .panel-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .panel-head h3 {
      margin: 0;
    }
    .shape-toggle,
    .layout-toggle {
      display: flex;
      gap: 4px;
    }
    .shape-toggle .btn,
    .layout-toggle .btn {
      flex: 1;
      justify-content: center;
    }
    .row-buttons {
      display: flex;
      gap: 6px;
    }
    .row-buttons .btn {
      flex: 1;
    }
    .active-toggle {
      background: color-mix(in srgb, var(--primary-color) 15%, transparent);
      color: var(--primary-color);
    }
    .bg-preview {
      width: 100%;
      border-radius: 6px;
      border: 1px solid var(--divider-color);
    }
    .link-section {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-top: 6px;
      border-top: 1px solid var(--divider-color);
    }
    .ports-editor {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 0;
      border-top: 1px solid var(--divider-color);
      border-bottom: 1px solid var(--divider-color);
    }
    .ports-group-label {
      font-size: 12px;
      color: var(--secondary-text-color);
      margin-top: 4px;
    }
    .port-edit-row {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    .port-edit-row .text {
      flex: 1;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
    @media (max-width: 640px) {
      .panel {
        width: calc(100vw - 48px);
      }
    }
  `,
})
export class DiagramCanvasComponent implements OnDestroy {
  private readonly api = inject(DiagramsApi);
  private readonly attachmentsApi = inject(AttachmentsApi);
  private readonly connectionsApi = inject(ConnectionsApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly modelService = inject(NgDiagramModelService);
  private readonly nodeService = inject(NgDiagramNodeService);
  private readonly selectionService = inject(NgDiagramSelectionService);
  private readonly viewportService = inject(NgDiagramViewportService);
  private readonly deviceDlg = viewChild.required<ElementRef<HTMLDialogElement>>('deviceDlg');

  readonly diagramId = input.required<string>();
  readonly areaId = input<string | null>(null);
  readonly deviceId = input<string | null>(null);
  readonly saved = output<DiagramDto>();
  readonly deleted = output<void>();

  protected readonly nodeTemplateMap = new NgDiagramNodeTemplateMap([
    ['dot', DotNodeComponent],
    ['box', BoxNodeComponent],
    ['box-ports', BoxPortsNodeComponent],
  ]);
  protected readonly model = signal<ModelAdapter | null>(null);
  protected readonly title = signal('');
  protected readonly saving = signal(false);
  protected readonly dirty = signal(false);
  protected readonly propertiesOpen = signal(false);
  protected readonly pickerTarget = signal<PickerTarget | null>(null);
  protected readonly imageAttachments = signal<AttachmentDto[]>([]);
  protected readonly siblingDiagrams = signal<DiagramDto[]>([]);
  protected readonly connections = signal<ConnectionDto[]>([]);
  protected readonly selection = signal<
    | { kind: 'node'; id: string; data: NodeData; locked: boolean }
    | { kind: 'edge'; id: string; data: EdgeData }
    | null
  >(null);

  /** A locked, back-of-stack box-linked-to-image acts as a backdrop and can't
   *  be clicked/selected directly — its settings live in Diagram properties. */
  protected readonly backgroundImage = computed(() =>
    this.modelService
      .nodes()
      .find((n) => {
        const data = n.data as NodeData;
        return data.shape === 'box' && data.link?.kind === 'image' && data.background;
      }) as NgNode<NodeData> | undefined
  );

  protected readonly icons = {
    dot: mdiCircleOutline,
    shape: mdiShapeOutline,
    ports: mdiElectricSwitch,
    device: mdiDevices,
    link: mdiLinkVariant,
    image: mdiImagePlus,
    delete: mdiDelete,
    save: mdiContentSave,
    open: mdiOpenInNew,
    locked: mdiLock,
    unlocked: mdiLockOpenVariantOutline,
    background: mdiImageOutline,
    properties: mdiTune,
    close: mdiClose,
    up: mdiChevronUp,
    down: mdiChevronDown,
  };

  private version = 1;
  private addCount = 0;

  constructor() {
    effect(() => {
      const id = this.diagramId();
      this.load(id);
    });
    effect(() => {
      const owner = this.attachmentOwner();
      this.attachmentsApi.listForOwner(owner).subscribe((atts) => {
        this.imageAttachments.set(atts.filter((a) => a.mimeType.startsWith('image/')));
      });
    });
    effect(() => {
      const areaId = this.areaId();
      const deviceId = this.deviceId();
      const current = this.diagramId();
      this.api
        .list(areaId ? { areaId } : deviceId ? { deviceId } : { standalone: '1' })
        .subscribe((diagrams) => this.siblingDiagrams.set(diagrams.filter((d) => d.id !== current)));
      this.connectionsApi
        .list(areaId ? { areaId } : deviceId ? { deviceId } : undefined)
        .subscribe((conns) => this.connections.set(conns));
    });
    effect(() => {
      const target = this.pickerTarget();
      const el = this.deviceDlg().nativeElement;
      const shouldOpen = target?.kind === 'link-device';
      if (shouldOpen && !el.open) el.showModal();
      if (!shouldOpen && el.open) el.close();
    });
  }

  ngOnDestroy(): void {
    this.model()?.destroy();
  }

  protected hasImageSource(): boolean {
    return this.imageAttachments().length > 0;
  }

  protected pickerFor(linkKind: 'device' | 'diagram' | 'image', nodeId: string): PickerTarget {
    if (linkKind === 'device') return { kind: 'link-device', nodeId };
    if (linkKind === 'diagram') return { kind: 'link-diagram', nodeId };
    return { kind: 'link-image', nodeId };
  }

  private attachmentOwner() {
    const areaId = this.areaId();
    const deviceId = this.deviceId();
    if (areaId) return { areaId };
    if (deviceId) return { deviceId };
    return { home: true as const };
  }

  private load(id: string): void {
    // Force <ng-diagram>/<ng-diagram-minimap> to fully unmount before the new
    // model is ready, rather than swapping the model on a live instance —
    // safer than relying on the library to rebind cleanly mid-session.
    this.model()?.destroy();
    this.model.set(null);
    this.api.get(id).subscribe((d) => {
      this.version = d.version;
      this.title.set(d.title);
      this.dirty.set(false);
      this.selection.set(null);
      this.propertiesOpen.set(false);
      queueMicrotask(() => {
        this.model.set(
          initializeModel(
            {
              nodes: d.content.nodes,
              edges: d.content.edges.map((e) => ({ ...e, data: e.data ?? {} })),
            },
            this.injector
          )
        );
      });
    });
  }

  protected onDiagramInit(): void {
    if ((this.model()?.getNodes().length ?? 0) > 0) {
      this.viewportService.zoomToFit();
    }
    this.model()?.onChange(() => this.dirty.set(true));
  }

  protected onSelectionChanged(event: SelectionChangedEvent): void {
    if (event.selectedNodes.length === 1 && event.selectedEdges.length === 0) {
      const n = event.selectedNodes[0];
      const data = n.data as NodeData;
      if (data.shape === 'box' && data.link?.kind === 'image' && data.background) {
        // A backdrop image isn't meant to be clickable — bounce the selection
        // away; its settings live in the Diagram properties panel instead.
        this.selectionService.deselect([n.id]);
        this.selection.set(null);
        return;
      }
      this.selection.set({ kind: 'node', id: n.id, data, locked: n.draggable === false });
    } else if (event.selectedEdges.length === 1 && event.selectedNodes.length === 0) {
      const e = event.selectedEdges[0];
      this.selection.set({ kind: 'edge', id: e.id, data: (e.data ?? {}) as EdgeData });
    } else {
      this.selection.set(null);
    }
  }

  /** Locking freezes drag + resize — handy for a node you've positioned exactly. */
  protected toggleLocked(nodeId: string, currentlyLocked: boolean): void {
    const locked = !currentlyLocked;
    this.modelService.updateNode(nodeId, { draggable: !locked, resizable: !locked });
    const sel = this.selection();
    if (sel?.kind === 'node' && sel.id === nodeId) {
      this.selection.set({ ...sel, locked });
    }
  }

  /**
   * If a hand-drawn edge connects two device-linked nodes and a real
   * Connection already exists between those devices, wire the edge to it
   * automatically — manual linking via the property panel covers every
   * other case (and lets you correct a wrong auto-match).
   */
  protected onEdgeDrawEnded(event: EdgeDrawEndedEvent): void {
    if (!event.success || !event.edge || !event.target) return;
    const sourceData = event.source.data as NodeData;
    const targetData = event.target.data as NodeData;
    if (sourceData.link?.kind !== 'device' || targetData.link?.kind !== 'device') return;
    const sourceDeviceId = sourceData.link.deviceId;
    const targetDeviceId = targetData.link.deviceId;
    const match = this.connections().find(
      (c) =>
        (c.fromDeviceId === sourceDeviceId && c.toDeviceId === targetDeviceId) ||
        (c.fromDeviceId === targetDeviceId && c.toDeviceId === sourceDeviceId)
    );
    if (match) {
      this.modelService.updateEdgeData(event.edge.id, {
        connectionId: match.id,
        label: match.label ?? undefined,
      });
      this.toast.info(`Linked to connection ${match.fromDeviceName} → ${match.toDeviceName}`);
    }
  }

  private nextPosition() {
    const v = this.viewportService.viewport();
    this.addCount++;
    return { x: v.x + (this.addCount % 5) * 30, y: v.y + Math.floor(this.addCount / 5) * 30 };
  }

  /** Updates a node's data and, if it's the current selection, refreshes the panel to match. */
  private updateSelectedNodeData(nodeId: string, data: NodeData): void {
    this.modelService.updateNodeData(nodeId, data);
    const sel = this.selection();
    if (sel?.kind === 'node' && sel.id === nodeId) {
      this.selection.set({ ...sel, data });
    }
  }

  protected addNode(shape: Shape): void {
    const data: NodeData =
      shape === 'box-ports'
        ? {
            shape,
            label: 'Switch box',
            ports: [
              { id: crypto.randomUUID(), label: 'In 1', direction: 'in' },
              { id: crypto.randomUUID(), label: 'Out 1', direction: 'out' },
            ],
          }
        : { shape, label: shape === 'dot' ? 'Marker' : 'Box', color: '#03a9f4' };
    this.modelService.addNodes([{ id: crypto.randomUUID(), type: shape, position: this.nextPosition(), data }]);
  }

  protected setShape(nodeId: string, shape: Shape, data: NodeData): void {
    const base = { label: data.label, color: data.color, link: data.link };
    const newData: NodeData =
      shape === 'box-ports'
        ? { ...base, shape, ports: data.shape === 'box-ports' ? data.ports : [] }
        : { ...base, shape };
    this.modelService.updateNode(nodeId, { type: shape, data: newData });
    const sel = this.selection();
    if (sel?.kind === 'node' && sel.id === nodeId) {
      this.selection.set({ ...sel, data: newData });
    }
  }

  protected addPort(nodeId: string, data: BoxPortsNodeData, direction: PortDirection): void {
    const port: NodePort = { id: crypto.randomUUID(), label: '', direction };
    this.updateSelectedNodeData(nodeId, { ...data, ports: [...data.ports, port] });
  }

  protected removePort(nodeId: string, data: BoxPortsNodeData, portId: string): void {
    this.updateSelectedNodeData(nodeId, { ...data, ports: data.ports.filter((p) => p.id !== portId) });
  }

  protected updatePortLabel(nodeId: string, data: BoxPortsNodeData, portId: string, event: Event): void {
    const label = (event.target as HTMLInputElement).value;
    this.updateSelectedNodeData(nodeId, {
      ...data,
      ports: data.ports.map((p) => (p.id === portId ? { ...p, label } : p)),
    });
  }

  protected movePort(nodeId: string, data: BoxPortsNodeData, portId: string, delta: -1 | 1): void {
    const target = data.ports.find((p) => p.id === portId);
    if (!target) return;
    const sameDirection = data.ports.filter((p) => p.direction === target.direction);
    const indexInList = sameDirection.findIndex((p) => p.id === portId);
    const swapIndexInList = indexInList + delta;
    if (swapIndexInList < 0 || swapIndexInList >= sameDirection.length) return;
    const swapId = sameDirection[swapIndexInList].id;
    const indexInAll = data.ports.findIndex((p) => p.id === portId);
    const swapIndexInAll = data.ports.findIndex((p) => p.id === swapId);
    const next = [...data.ports];
    next[indexInAll] = data.ports[swapIndexInAll];
    next[swapIndexInAll] = data.ports[indexInAll];
    this.updateSelectedNodeData(nodeId, { ...data, ports: next });
  }

  protected openPicker(target: PickerTarget): void {
    this.pickerTarget.set(target);
  }

  protected closeDeviceDialog(): void {
    this.pickerTarget.set(null);
  }

  protected onDevicePicked(device: DeviceDto): void {
    const target = this.pickerTarget();
    if (!target || target.kind !== 'link-device') return;
    const existing = this.modelService.getNodeById<NodeData>(target.nodeId)?.data;
    if (existing) {
      this.updateSelectedNodeData(target.nodeId, {
        ...existing,
        link: { kind: 'device', deviceId: device.id },
        label: existing.label || device.name,
      });
    }
    this.pickerTarget.set(null);
  }

  /** Turns a box linked to an image into a locked, back-of-stack backdrop. */
  protected useAsBackground(nodeId: string, data: NodeData): void {
    this.nodeService.sendToBack([nodeId]);
    this.modelService.updateNode(nodeId, {
      draggable: false,
      resizable: false,
      autoSize: false,
      size: { width: 900, height: 650 },
      position: { x: 0, y: 0 },
      data: { ...data, background: true },
    });
    this.selection.set(null);
  }

  private addBackgroundImageNode(attachment: AttachmentDto): void {
    const id = crypto.randomUUID();
    this.modelService.addNodes([
      {
        id,
        type: 'box',
        position: { x: 0, y: 0 },
        size: { width: 900, height: 650 },
        autoSize: false,
        draggable: false,
        resizable: false,
        data: {
          shape: 'box',
          label: attachment.title ?? attachment.originalName,
          link: { kind: 'image', attachmentId: attachment.id },
          background: true,
        },
      },
    ]);
    this.nodeService.sendToBack([id]);
  }

  protected removeBackground(node: NgNode<NodeData>): void {
    this.modelService.updateNode(node.id, {
      draggable: true,
      resizable: true,
      data: { ...node.data, background: false },
    });
  }

  protected backgroundImageUrl(node: NgNode<NodeData>): string {
    return node.data.link?.kind === 'image' ? attachmentUrl(node.data.link.attachmentId) : '';
  }

  protected openConnectionDevice(connectionId: string): void {
    const c = this.connections().find((x) => x.id === connectionId);
    if (c) this.router.navigate(['/devices', c.fromDeviceId]);
  }

  protected onAttachmentPicked(attachment: AttachmentDto): void {
    const target = this.pickerTarget();
    if (!target) return;
    if (target.kind === 'set-diagram-background') {
      this.addBackgroundImageNode(attachment);
    } else if (target.kind === 'link-image') {
      const existing = this.modelService.getNodeById<NodeData>(target.nodeId)?.data;
      if (existing) {
        this.updateSelectedNodeData(target.nodeId, {
          ...existing,
          link: { kind: 'image', attachmentId: attachment.id },
          label: existing.label || attachment.title || attachment.originalName,
        });
      }
    }
    this.pickerTarget.set(null);
  }

  protected onDiagramLinkPicked(diagram: DiagramDto): void {
    const target = this.pickerTarget();
    if (!target || target.kind !== 'link-diagram') return;
    const existing = this.modelService.getNodeById<NodeData>(target.nodeId)?.data;
    if (existing) {
      this.updateSelectedNodeData(target.nodeId, {
        ...existing,
        link: { kind: 'diagram', diagramId: diagram.id },
        label: existing.label || diagram.title,
      });
    }
    this.pickerTarget.set(null);
  }

  protected removeLink(nodeId: string, data: NodeData): void {
    const { link, ...rest } = data;
    void link;
    this.updateSelectedNodeData(nodeId, rest as NodeData);
  }

  protected onConnectionPicked(connection: ConnectionDto): void {
    const target = this.pickerTarget();
    if (!target || target.kind !== 'edge-connection') return;
    const current = this.selection();
    const label = current?.kind === 'edge' ? current.data.label : undefined;
    this.modelService.updateEdgeData(target.edgeId, { connectionId: connection.id, label });
    this.pickerTarget.set(null);
  }

  protected connectionLabel(connectionId: string): string {
    const c = this.connections().find((x) => x.id === connectionId);
    return c ? `${c.fromDeviceName} → ${c.toDeviceName}` : connectionId;
  }

  protected setNodeLabel(nodeId: string, data: NodeData, event: Event): void {
    const label = (event.target as HTMLInputElement).value;
    this.updateSelectedNodeData(nodeId, { ...data, label });
  }

  protected setNodeColor(nodeId: string, data: NodeData, event: Event): void {
    const color = (event.target as HTMLInputElement).value;
    this.updateSelectedNodeData(nodeId, { ...data, color });
  }

  protected setEdgeLabel(edgeId: string, event: Event): void {
    const label = (event.target as HTMLInputElement).value;
    const sel = this.selection();
    if (sel?.kind !== 'edge') return;
    this.modelService.updateEdgeData(edgeId, { ...sel.data, label });
  }

  protected openDevice(deviceId: string): void {
    this.router.navigate(['/devices', deviceId]);
  }

  protected openDiagram(diagramId: string): void {
    const queryParams = this.areaId()
      ? { areaId: this.areaId(), open: diagramId }
      : this.deviceId()
        ? { deviceId: this.deviceId(), open: diagramId }
        : { standalone: '1', open: diagramId };
    this.router.navigate(['/diagrams'], { queryParams });
  }

  protected async deleteSelection(): Promise<void> {
    const sel = this.selection();
    if (!sel) return;
    if (sel.kind === 'node') {
      this.modelService.deleteNodes([sel.id]);
    } else {
      this.modelService.deleteEdges([sel.id]);
    }
    this.selection.set(null);
  }

  protected renameTitle(event: Event): void {
    const title = (event.target as HTMLInputElement).value.trim();
    if (!title || title === this.title()) return;
    this.api.update(this.diagramId(), { title }).subscribe((updated) => {
      this.title.set(updated.title);
      this.toast.success('Diagram renamed');
      this.saved.emit(updated);
    });
  }

  protected async deleteDiagram(): Promise<void> {
    const confirmed = await this.confirm.ask(`Delete diagram "${this.title()}"?`, {
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;
    this.api.remove(this.diagramId()).subscribe(() => {
      this.toast.success('Diagram deleted');
      this.deleted.emit();
    });
  }

  protected save(): void {
    const model = this.model();
    if (!model) return;
    this.saving.set(true);
    const content = toContent(model.getNodes(), model.getEdges());
    this.api.putContent(this.diagramId(), this.version, content).subscribe({
      next: (updated) => {
        this.version = updated.version;
        this.saving.set(false);
        this.dirty.set(false);
        this.toast.success('Diagram saved');
        this.saved.emit(updated);
      },
      error: (err) => {
        this.saving.set(false);
        if (err?.status === 409) {
          this.toast.error(
            'Diagram was changed elsewhere — reload the page to get the latest version.'
          );
        } else {
          this.toast.error('Failed to save diagram');
        }
      },
    });
  }
}
