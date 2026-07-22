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
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { filter, firstValueFrom, map } from 'rxjs';
import { toPng } from 'html-to-image';
import {
  Edge as NgEdge,
  EdgeDrawEndedEvent,
  initializeModel,
  Middleware,
  ModelActionType,
  ModelAdapter,
  NgDiagramBackgroundComponent,
  NgDiagramComponent,
  NgDiagramMarkerComponent,
  NgDiagramMinimapComponent,
  NgDiagramModelService,
  NgDiagramNodeService,
  NgDiagramService,
  NgDiagramNodeTemplateMap,
  NgDiagramSelectionService,
  NgDiagramViewportService,
  Node as NgNode,
  provideNgDiagram,
  SelectionChangedEvent,
} from 'ng-diagram';
import {
  AreaDto,
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
import {
  attachmentUrl,
  AreasApi,
  AttachmentsApi,
  ConnectionsApi,
  DevicesApi,
  DiagramsApi,
} from '../../core/api/api.services';
import { ToastService } from '../../core/toast/toast.service';
import { ConfirmService } from '../../core/confirm/confirm.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { DevicePickerComponent } from '../../shared/ui/device-picker.component';
import { DotNodeComponent } from './nodes/dot-node.component';
import { BoxNodeComponent } from './nodes/box-node.component';
import { BoxPortsNodeComponent } from './nodes/box-ports-node.component';
import { AreaPickerDialogComponent } from './pickers/area-picker-dialog.component';
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
  mdiFloorPlan,
  mdiImageOutline,
  mdiImagePlus,
  mdiLinkVariant,
  mdiLock,
  mdiLockOpenVariantOutline,
  mdiOpenInNew,
  mdiPencil,
  mdiShapeOutline,
  mdiTune,
} from '@mdi/js';

type Shape = 'dot' | 'box' | 'box-ports';

/** Every model action that mutates the diagram (as opposed to viewing/navigating
 *  it) — blocked at the engine level in read-only mode. This is the actual
 *  guarantee against accidental changes; per-node draggable/resizable and the
 *  nodeDraggingEnabled/linking config are only there to keep the UI (handles,
 *  cursors) from suggesting an action is possible when it would be cancelled
 *  anyway. Rotation in particular has no per-node opt-out, so without this
 *  middleware a "locked" node could still be rotated. */
const READ_ONLY_BLOCKED_ACTIONS: ModelActionType[] = [
  'moveNodesBy',
  'moveNodes',
  'moveNodesStart',
  'moveNodesStop',
  'deleteSelection',
  'addNodes',
  'updateNode',
  'updateNodes',
  'deleteNodes',
  'clearModel',
  'paletteDropNode',
  'addEdges',
  'updateEdge',
  'deleteEdges',
  'deleteElements',
  'addEdgeLabelsBulk',
  'updateEdgeLabelsBulk',
  'deleteEdgeLabelsBulk',
  'addPortsBulk',
  'updatePortsBulk',
  'deletePortsBulk',
  'paste',
  'resizeNode',
  'resizeNodeStart',
  'resizeNodeStop',
  'startLinking',
  'moveTemporaryEdge',
  'finishLinking',
  'changeZOrder',
  'rotateNodeTo',
  'rotateNodeStart',
  'rotateNodeStop',
  'highlightGroup',
  'highlightGroupClear',
];

type PickerTarget =
  | { kind: 'link-area'; nodeId: string }
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
      sourceArrowhead: e.sourceArrowhead,
      targetArrowhead: e.targetArrowhead,
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
    NgDiagramMarkerComponent,
    NgDiagramMinimapComponent,
    IconComponent,
    DevicePickerComponent,
    AreaPickerDialogComponent,
    AttachmentPickerDialogComponent,
    DiagramLinkPickerDialogComponent,
    ConnectionPickerDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="canvas-wrap" [class.read-only]="readOnly()">
      @if (model(); as m) {
        <ng-diagram
          #canvasEl
          [model]="m"
          [nodeTemplateMap]="nodeTemplateMap"
          (diagramInit)="onDiagramInit()"
          (selectionChanged)="onSelectionChanged($event)"
          (edgeDrawEnded)="onEdgeDrawEnded($event)"
        >
          <ng-diagram-background type="dots" />
          <ng-diagram-marker>
            <svg>
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
                </marker>
              </defs>
            </svg>
          </ng-diagram-marker>
        </ng-diagram>
        <ng-diagram-minimap position="bottom-right" [width]="180" [height]="130" [showZoomControls]="true" />
      }

      @if (!readOnly()) {
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
      }

      <div class="overlay save-overlay">
        @if (readOnly()) {
          <button class="btn" (click)="enterEditMode()">
            <app-icon [path]="icons.edit" [size]="18" /> Edit
          </button>
        } @else {
          @if (dirty()) {
            <span class="dirty-dot" title="Unsaved changes"></span>
          }
          <button class="btn" [disabled]="saving()" (click)="saveAndExitEditMode()">
            <app-icon [path]="icons.save" [size]="18" /> Save
          </button>
        }
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
            @if (readOnly()) {
              @if (sel.data.label) {
                <div class="field">
                  <span>Label</span>
                  <div class="value">{{ sel.data.label }}</div>
                </div>
              }
            } @else {
              <label class="field">
                <span>Label</span>
                <input
                  class="text"
                  [value]="sel.data.label ?? ''"
                  (change)="setNodeLabel(sel.id, sel.data, $event)"
                />
              </label>
            }

            @if (readOnly()) {
              <div class="fields-inline">
                <div class="field">
                  <span>Color</span>
                  <span class="swatch" [style.background]="sel.data.color ?? '#03a9f4'"></span>
                </div>
                @if (sel.data.shape === 'box') {
                  <div class="field">
                    <span>Border color</span>
                    <span class="swatch" [style.background]="sel.data.borderColor ?? '#03a9f4'"></span>
                  </div>
                }
              </div>
            } @else if (sel.data.shape === 'box') {
              <div class="fields-inline">
                <label class="field">
                  <span>Color</span>
                  <input
                    type="color"
                    [value]="sel.data.color ?? '#03a9f4'"
                    (change)="setNodeColor(sel.id, sel.data, $event)"
                  />
                </label>
                <label class="field">
                  <span>Border color</span>
                  <input
                    type="color"
                    [value]="sel.data.borderColor ?? '#03a9f4'"
                    (change)="setNodeBorderColor(sel.id, sel.data, $event)"
                  />
                </label>
              </div>
            } @else {
              <label class="field">
                <span>Color</span>
                <input
                  type="color"
                  [value]="sel.data.color ?? '#03a9f4'"
                  (change)="setNodeColor(sel.id, sel.data, $event)"
                />
              </label>
            }

            @if (!readOnly()) {
              <div class="shape-toggle">
                <button
                  class="btn secondary"
                  [class.active-toggle]="sel.data.shape === 'dot'"
                  [disabled]="sel.data.shape === 'box-ports'"
                  title="Dot marker"
                  (click)="setShape(sel.id, 'dot', sel.data)"
                >
                  <app-icon [path]="icons.dot" [size]="16" />
                </button>
                <button
                  class="btn secondary"
                  [class.active-toggle]="sel.data.shape === 'box'"
                  [disabled]="sel.data.shape === 'box-ports'"
                  title="Box"
                  (click)="setShape(sel.id, 'box', sel.data)"
                >
                  <app-icon [path]="icons.shape" [size]="16" />
                </button>
                <button
                  class="btn secondary"
                  [class.active-toggle]="sel.data.shape === 'box-ports'"
                  [disabled]="sel.data.shape !== 'box-ports'"
                  title="Box with ports (set when creating the node — can't be converted, it would lose its port configuration)"
                  (click)="setShape(sel.id, 'box-ports', sel.data)"
                >
                  <app-icon [path]="icons.ports" [size]="16" />
                </button>
              </div>
            }

            @if (sel.data.shape === 'box-ports') {
              <div class="ports-editor">
                <span class="ports-group-label">Inputs</span>
                @for (port of sel.data.ports; track port.id) {
                  @if (port.direction === 'in') {
                    @if (readOnly()) {
                      <div class="port-view-row">{{ port.label || '—' }}</div>
                    } @else {
                      <div class="port-edit-row">
                        <input
                          class="text"
                          placeholder="Label"
                          [value]="port.label"
                          (change)="updatePortLabel(sel.id, sel.data, port.id, $event)"
                        />
                        <button
                          class="btn icon-only"
                          title="Move up"
                          (click)="movePort(sel.id, sel.data, port.id, -1)"
                        >
                          <app-icon [path]="icons.up" [size]="14" />
                        </button>
                        <button
                          class="btn icon-only"
                          title="Move down"
                          (click)="movePort(sel.id, sel.data, port.id, 1)"
                        >
                          <app-icon [path]="icons.down" [size]="14" />
                        </button>
                        <button
                          class="btn icon-only"
                          title="Remove port"
                          (click)="removePort(sel.id, sel.data, port.id)"
                        >
                          <app-icon [path]="icons.delete" [size]="14" />
                        </button>
                      </div>
                    }
                  }
                }
                @if (!readOnly()) {
                  <button class="btn secondary" (click)="addPort(sel.id, sel.data, 'in')">+ Input port</button>
                }

                <span class="ports-group-label">Outputs</span>
                @for (port of sel.data.ports; track port.id) {
                  @if (port.direction === 'out') {
                    @if (readOnly()) {
                      <div class="port-view-row">{{ port.label || '—' }}</div>
                    } @else {
                      <div class="port-edit-row">
                        <input
                          class="text"
                          placeholder="Label"
                          [value]="port.label"
                          (change)="updatePortLabel(sel.id, sel.data, port.id, $event)"
                        />
                        <button
                          class="btn icon-only"
                          title="Move up"
                          (click)="movePort(sel.id, sel.data, port.id, -1)"
                        >
                          <app-icon [path]="icons.up" [size]="14" />
                        </button>
                        <button
                          class="btn icon-only"
                          title="Move down"
                          (click)="movePort(sel.id, sel.data, port.id, 1)"
                        >
                          <app-icon [path]="icons.down" [size]="14" />
                        </button>
                        <button
                          class="btn icon-only"
                          title="Remove port"
                          (click)="removePort(sel.id, sel.data, port.id)"
                        >
                          <app-icon [path]="icons.delete" [size]="14" />
                        </button>
                      </div>
                    }
                  }
                }
                @if (!readOnly()) {
                  <button class="btn secondary" (click)="addPort(sel.id, sel.data, 'out')">+ Output port</button>
                }
              </div>
            }

            <div class="link-section">
              @if (sel.data.link; as link) {
                @if (link.kind === 'area') {
                  <div class="linked-preview">
                    <app-icon [path]="icons.area" [size]="16" />
                    <span>{{ areaName(link.areaId) }}</span>
                  </div>
                  <button class="btn secondary" (click)="openArea(link.areaId)">
                    <app-icon [path]="icons.open" [size]="16" /> Open area
                  </button>
                }
                @if (link.kind === 'device') {
                  <div class="linked-preview">
                    <app-icon [path]="icons.device" [size]="16" />
                    <span>{{ deviceName(link.deviceId) }}</span>
                  </div>
                  <button class="btn secondary" (click)="openDevice(link.deviceId)">
                    <app-icon [path]="icons.open" [size]="16" /> Open device
                  </button>
                }
                @if (link.kind === 'diagram') {
                  <div class="linked-preview">
                    <app-icon [path]="icons.link" [size]="16" />
                    <span>{{ diagramTitle(link.diagramId) }}</span>
                  </div>
                  <button class="btn secondary" (click)="openDiagram(link.diagramId)">
                    <app-icon [path]="icons.open" [size]="16" /> Open diagram
                  </button>
                }
                @if (link.kind === 'image') {
                  <img
                    class="link-thumb"
                    [src]="linkImageUrl(link.attachmentId)"
                    alt=""
                    title="Open image"
                    (click)="openImage(link.attachmentId)"
                  />
                }
                @if (!readOnly()) {
                  <button class="btn secondary" (click)="openPicker(pickerFor(link.kind, sel.id))">
                    Change {{ link.kind }} link
                  </button>
                  <button class="btn secondary" (click)="removeLink(sel.id, sel.data)">Remove link</button>
                  @if (link.kind === 'image' && sel.data.shape === 'box' && !sel.data.background) {
                    <button class="btn secondary" (click)="useAsBackground(sel.id, sel.data)">
                      <app-icon [path]="icons.background" [size]="16" /> Use as background
                    </button>
                  }
                }
              } @else if (!readOnly()) {
                <button class="btn secondary" (click)="openPicker({ kind: 'link-area', nodeId: sel.id })">
                  <app-icon [path]="icons.area" [size]="16" /> Link to area
                </button>
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

            @if (!readOnly()) {
              <button class="btn secondary" (click)="toggleLocked(sel.id, sel.locked)">
                <app-icon [path]="sel.locked ? icons.locked : icons.unlocked" [size]="16" />
                {{ sel.locked ? 'Locked — click to unlock' : 'Lock in place' }}
              </button>
            }
          } @else {
            <h3>Connection</h3>
            @if (readOnly()) {
              @if (sel.data.label) {
                <div class="field">
                  <span>Label</span>
                  <div class="value">{{ sel.data.label }}</div>
                </div>
              }
              @if (sel.sourceArrowhead || sel.targetArrowhead) {
                <div class="value muted">
                  @if (sel.sourceArrowhead) {
                    Arrow at start
                  }
                  @if (sel.sourceArrowhead && sel.targetArrowhead) {
                    ·
                  }
                  @if (sel.targetArrowhead) {
                    Arrow at end
                  }
                </div>
              }
            } @else {
              <label class="field">
                <span>Label</span>
                <input class="text" [value]="sel.data.label ?? ''" (change)="setEdgeLabel(sel.id, $event)" />
              </label>
              <label class="field-row">
                <input
                  type="checkbox"
                  [checked]="!!sel.sourceArrowhead"
                  (change)="setEdgeArrowhead(sel.id, 'source', $event)"
                />
                <span>Arrow at start</span>
              </label>
              <label class="field-row">
                <input
                  type="checkbox"
                  [checked]="!!sel.targetArrowhead"
                  (change)="setEdgeArrowhead(sel.id, 'target', $event)"
                />
                <span>Arrow at end</span>
              </label>
            }
            @if (sel.data.connectionId) {
              <span class="muted">{{ connectionLabel(sel.data.connectionId) }}</span>
              <button class="btn secondary" (click)="openConnectionDevice(sel.data.connectionId)">
                <app-icon [path]="icons.open" [size]="16" /> Open connection
              </button>
            }
            @if (!readOnly() && connections().length > 0) {
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

    <app-area-picker-dialog
      [open]="pickerTarget()?.kind === 'link-area'"
      [areas]="areas()"
      (closed)="pickerTarget.set(null)"
      (picked)="onAreaLinkPicked($event)"
    />
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
    .port-view-row {
      font-size: 13px;
      color: var(--primary-text-color);
      padding: 2px 0;
    }
    .value {
      font-size: 13px;
      color: var(--primary-text-color);
    }
    .value.muted {
      color: var(--secondary-text-color);
    }
    .swatch {
      display: block;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: 1px solid var(--divider-color);
    }
    .linked-preview {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--primary-text-color);
    }
    .link-thumb {
      width: 100%;
      max-height: 140px;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--divider-color);
      cursor: pointer;
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
  private readonly devicesApi = inject(DevicesApi);
  private readonly areasApi = inject(AreasApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly modelService = inject(NgDiagramModelService);
  private readonly nodeService = inject(NgDiagramNodeService);
  private readonly diagramService = inject(NgDiagramService);
  private readonly selectionService = inject(NgDiagramSelectionService);
  private readonly viewportService = inject(NgDiagramViewportService);
  private readonly deviceDlg = viewChild.required<ElementRef<HTMLDialogElement>>('deviceDlg');
  private readonly canvasEl = viewChild<unknown, ElementRef<HTMLElement>>('canvasEl', { read: ElementRef });

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
  /** Diagrams open read-only; "Edit" unlocks dragging/resizing/linking and the
   *  editing toolbar, "Save" persists and locks it back down. Clicking a
   *  linked node while read-only navigates to the link immediately instead
   *  of selecting it. */
  protected readonly readOnly = signal(true);
  protected readonly title = signal('');
  protected readonly saving = signal(false);
  protected readonly dirty = signal(false);
  protected readonly propertiesOpen = signal(false);
  protected readonly pickerTarget = signal<PickerTarget | null>(null);
  protected readonly imageAttachments = signal<AttachmentDto[]>([]);
  protected readonly siblingDiagrams = signal<DiagramDto[]>([]);
  protected readonly connections = signal<ConnectionDto[]>([]);
  /** Device links aren't scoped to this diagram's area/device (the picker
   *  searches all devices), so resolving a linked device's name needs the
   *  full list rather than something already loaded for this page. */
  protected readonly devices = signal<DeviceDto[]>([]);
  /** Same reasoning as `devices` — area links aren't scoped to this diagram. */
  protected readonly areas = signal<AreaDto[]>([]);
  protected readonly selection = signal<
    | { kind: 'node'; id: string; data: NodeData; locked: boolean }
    | { kind: 'edge'; id: string; data: EdgeData; sourceArrowhead?: string; targetArrowhead?: string }
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
    area: mdiFloorPlan,
    device: mdiDevices,
    link: mdiLinkVariant,
    image: mdiImagePlus,
    delete: mdiDelete,
    save: mdiContentSave,
    edit: mdiPencil,
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
  /**
   * Plain (non-signal) reference to the live model, used only for cleanup.
   * `load()` runs inside an effect watching `diagramId()` — reading the
   * `model` signal there (even via `this.model()?.destroy()`) would make
   * that effect implicitly depend on `model` too, and since `load()` also
   * writes to `model`, every write would re-trigger the effect and call
   * `load()` again, forever. Tracking the ref outside the signal graph
   * breaks that cycle.
   */
  private currentModel: ModelAdapter | null = null;
  private unregisterReadOnlyGuard: (() => void) | null = null;

  constructor() {
    this.devicesApi.list().subscribe((devices) => this.devices.set(devices));
    this.areasApi.list().subscribe((areas) => this.areas.set(areas));
    effect(() => {
      const id = this.diagramId();
      this.load(id, true);
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
    this.currentModel?.destroy();
    this.unregisterReadOnlyGuard?.();
  }

  protected hasImageSource(): boolean {
    return this.imageAttachments().length > 0;
  }

  protected pickerFor(linkKind: 'area' | 'device' | 'diagram' | 'image', nodeId: string): PickerTarget {
    if (linkKind === 'area') return { kind: 'link-area', nodeId };
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

  private load(id: string, isInitialOpen = false): void {
    // Force <ng-diagram>/<ng-diagram-minimap> to fully unmount before the new
    // model is ready, rather than swapping the model on a live instance —
    // safer than relying on the library to rebind cleanly mid-session.
    this.currentModel?.destroy();
    this.currentModel = null;
    this.model.set(null);
    this.api.get(id).subscribe((d) => {
      this.version = d.version;
      this.title.set(d.title);
      this.dirty.set(false);
      this.selection.set(null);
      this.propertiesOpen.set(false);
      // A freshly opened, still-empty diagram (just created) starts in edit
      // mode — there's nothing to view read-only, and you're about to draw
      // on it anyway. Only on the initial open of this diagram id, so this
      // can't fight enterEditMode()/saveAndExitEditMode()'s own state changes.
      if (isInitialOpen && d.content.nodes.length === 0) {
        this.readOnly.set(false);
      }
      queueMicrotask(() => {
        const readOnly = this.readOnly();
        const m = initializeModel(
          {
            nodes: d.content.nodes.map((n) =>
              readOnly ? { ...n, draggable: false, resizable: false } : n
            ),
            edges: d.content.edges.map((e) => ({ ...e, data: e.data ?? {} })),
          },
          this.injector
        );
        this.currentModel = m;
        this.model.set(m);
      });
    });
  }

  protected onDiagramInit(): void {
    // Both calls need the engine initialized, which only happens once
    // <ng-diagram> has actually mounted and fired this event — calling them
    // from the constructor throws "Library engine not initialized yet".
    this.unregisterReadOnlyGuard?.();
    this.unregisterReadOnlyGuard = this.diagramService.registerMiddleware({
      name: 'read-only-guard',
      execute: (context, next, cancel) => {
        const blocked: readonly string[] = READ_ONLY_BLOCKED_ACTIONS;
        if (this.readOnly() && context.modelActionTypes.some((a) => blocked.includes(a))) {
          cancel();
          return;
        }
        next();
      },
    } satisfies Middleware<'read-only-guard'>);
    this.diagramService.updateConfig({
      nodeDraggingEnabled: !this.readOnly(),
      linking: { validateConnection: () => !this.readOnly() },
    });

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
      this.selection.set({
        kind: 'edge',
        id: e.id,
        data: (e.data ?? {}) as EdgeData,
        sourceArrowhead: e.sourceArrowhead,
        targetArrowhead: e.targetArrowhead,
      });
    } else {
      this.selection.set(null);
    }
  }

  protected openImage(attachmentId: string): void {
    window.open(attachmentUrl(attachmentId), '_blank');
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
    const base = { label: data.label, color: data.color, borderColor: data.borderColor, link: data.link };
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

  protected linkImageUrl(attachmentId: string): string {
    return attachmentUrl(attachmentId);
  }

  protected deviceName(deviceId: string): string {
    return this.devices().find((d) => d.id === deviceId)?.name ?? deviceId;
  }

  protected areaName(areaId: string): string {
    return this.areas().find((a) => a.id === areaId)?.name ?? areaId;
  }

  protected diagramTitle(diagramId: string): string {
    return this.siblingDiagrams().find((d) => d.id === diagramId)?.title ?? diagramId;
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

  protected onAreaLinkPicked(area: AreaDto): void {
    const target = this.pickerTarget();
    if (!target || target.kind !== 'link-area') return;
    const existing = this.modelService.getNodeById<NodeData>(target.nodeId)?.data;
    if (existing) {
      this.updateSelectedNodeData(target.nodeId, {
        ...existing,
        link: { kind: 'area', areaId: area.id },
        label: existing.label || area.name,
      });
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

  protected setNodeBorderColor(nodeId: string, data: NodeData, event: Event): void {
    const borderColor = (event.target as HTMLInputElement).value;
    this.updateSelectedNodeData(nodeId, { ...data, borderColor });
  }

  protected setEdgeLabel(edgeId: string, event: Event): void {
    const label = (event.target as HTMLInputElement).value;
    const sel = this.selection();
    if (sel?.kind !== 'edge') return;
    this.modelService.updateEdgeData(edgeId, { ...sel.data, label });
  }

  protected setEdgeArrowhead(edgeId: string, end: 'source' | 'target', event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const arrowhead = checked ? 'arrow' : undefined;
    const sel = this.selection();
    if (sel?.kind !== 'edge') return;
    const key = end === 'source' ? 'sourceArrowhead' : 'targetArrowhead';
    this.modelService.updateEdge(edgeId, { [key]: arrowhead });
    this.selection.set({ ...sel, [key]: arrowhead });
  }

  protected openDevice(deviceId: string): void {
    this.router.navigate(['/devices', deviceId]);
  }

  protected openArea(areaId: string): void {
    this.router.navigate(['/areas', areaId]);
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

  protected enterEditMode(): void {
    this.readOnly.set(false);
    this.load(this.diagramId());
  }

  /** Save button: persists changes if any, then locks back to read-only
   *  either way — it doubles as "done editing". */
  protected async saveAndExitEditMode(): Promise<void> {
    if (!this.dirty()) {
      // Nothing changed, but still worth (re)capturing the preview — e.g.
      // the very first time you hit Save on a diagram with no prior preview.
      await this.capturePreview();
      this.readOnly.set(true);
      this.load(this.diagramId());
      return;
    }
    const model = this.model();
    if (!model) return;
    this.saving.set(true);
    const content = toContent(model.getNodes(), model.getEdges());
    this.api.putContent(this.diagramId(), this.version, content).subscribe({
      next: async (updated) => {
        this.version = updated.version;
        this.saving.set(false);
        this.dirty.set(false);
        this.toast.success('Diagram saved');
        this.saved.emit(updated);
        // Capture before load() tears the canvas down to rebuild it read-only.
        await this.capturePreview();
        this.readOnly.set(true);
        this.load(this.diagramId());
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

  /** Snapshots the rendered canvas to a PNG and uploads it as this diagram's
   *  preview — shown on the area/device page instead of a generic icon.
   *  Best-effort: a failure here shouldn't block the save itself, but it's
   *  surfaced (not just logged) so a broken capture doesn't look like nothing
   *  happened. */
  private async capturePreview(): Promise<void> {
    const el = this.canvasEl()?.nativeElement;
    if (!el) {
      console.warn('capturePreview: #canvasEl not found, skipping');
      return;
    }
    try {
      const dataUrl = await toPng(el, { pixelRatio: 1 });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'diagram-preview.png', { type: 'image/png' });
      const attachment = await firstValueFrom(
        this.attachmentsApi.upload({ home: true }, file, 'diagram').pipe(
          filter((event): event is HttpResponse<AttachmentDto> => event.type === HttpEventType.Response),
          map((event) => event.body as AttachmentDto)
        )
      );
      await firstValueFrom(this.api.update(this.diagramId(), { previewAttachmentId: attachment.id }));
    } catch (err) {
      console.error('Failed to capture diagram preview', err);
      this.toast.error('Could not generate a preview image for this diagram');
    }
  }
}
