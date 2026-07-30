import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
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
  NgDiagramEdgeTemplateMap,
  NgDiagramMarkerComponent,
  NgDiagramMinimapComponent,
  NgDiagramModelService,
  NgDiagramNodeService,
  NgDiagramService,
  NgDiagramNodeTemplateMap,
  NgDiagramSelectionService,
  NgDiagramViewportService,
  Node as NgNode,
  NodeDragEndedEvent,
  provideNgDiagram,
  SelectionChangedEvent,
  SelectionMovedEvent,
  ViewportChangedEvent,
} from 'ng-diagram';
import {
  AreaDto,
  AttachmentDto,
  BoxPortsNodeData,
  ConnectionDto,
  ConnectionType,
  DeviceDto,
  DiagramContent,
  DiagramDto,
  DiagramNode,
  DiagramViewport,
  EdgeData,
  NodeData,
  NodeLink,
  NodePort,
  PortDirection,
  WIRE_TYPES,
  wireOrCableColor,
  WireOrCableType,
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
import { ConnectionTypesStore } from '../../core/connection-types/connection-types.store';
import { IconComponent } from '../../shared/ui/icon.component';
import { DevicePickerComponent } from '../../shared/ui/device-picker.component';
import { DotNodeComponent } from './nodes/dot-node.component';
import { BoxNodeComponent } from './nodes/box-node.component';
import { BoxPortsNodeComponent } from './nodes/box-ports-node.component';
import { BackgroundImageNodeComponent } from './nodes/background-image-node.component';
import { WireEdgeComponent } from './edges/wire-edge.component';
import { AreaPickerDialogComponent } from './pickers/area-picker-dialog.component';
import { AttachmentPickerDialogComponent } from './pickers/attachment-picker-dialog.component';
import { DiagramLinkPickerDialogComponent } from './pickers/diagram-link-picker-dialog.component';
import { ConnectionPickerDialogComponent } from './pickers/connection-picker-dialog.component';
import { EdgeReshapeOverlayComponent } from './edge-reshaping/edge-reshape-overlay.component';
import { EdgeCommandDispatcher } from './edge-reshaping/commands';
import { EdgeReshapeHandler } from './edge-reshaping/handlers/edge-reshape.handler';
import { applyEdgeStretchOnSelectionMoved } from './edge-reshaping/middleware/edge-stretch-on-move';
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
  mdiImagePlus,
  mdiLinkVariant,
  mdiLock,
  mdiLockOpenVariantOutline,
  mdiOpenInNew,
  mdiPencil,
  mdiShapeOutline,
  mdiTransitConnectionVariant,
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
  | { kind: 'link-connection'; nodeId: string }
  | { kind: 'set-diagram-background' }
  | { kind: 'edge-connection'; edgeId: string };


function toContent(nodes: NgNode[], edges: NgEdge[], viewport?: DiagramViewport): DiagramContent {
  return {
    schemaVersion: 1,
    viewport,
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
      type: e.type,
      points: e.points,
      routing: e.routing,
      routingMode: e.routingMode,
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
  providers: [provideNgDiagram(), EdgeCommandDispatcher, EdgeReshapeHandler],
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
    EdgeReshapeOverlayComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="canvas-wrap" [class.read-only]="readOnly()">
      @if (model(); as m) {
        <ng-diagram
          #canvasEl
          [model]="m"
          [nodeTemplateMap]="nodeTemplateMap"
          [edgeTemplateMap]="edgeTemplateMap"
          (diagramInit)="onDiagramInit()"
          (selectionChanged)="onSelectionChanged($event)"
          (edgeDrawEnded)="onEdgeDrawEnded($event)"
          (selectionMoved)="onSelectionMoved($event)"
          (nodeDragEnded)="onNodeDragEnded($event)"
          (viewportChanged)="onViewportChanged($event)"
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
        <div class="overlay zoom-reset-overlay">
          <button class="btn secondary" title="Reset zoom to 100%" (click)="resetZoom()">100%</button>
        </div>
        @if (!readOnly()) {
          <app-edge-reshape-overlay />
        }
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
                <button class="btn secondary" (click)="unlockBackground(bg)">Unlock to move/resize</button>
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

      @if (!readOnly()) {
        @if (selection(); as sel) {
          <div class="overlay panel selection-overlay card">
            @if (sel.kind === 'node') {
              <h3>{{ sel.data.shape === 'background-image' ? 'Background image' : sel.data.shape }}</h3>
              <label class="field">
                <span>Label</span>
                <input
                  class="text"
                  [value]="sel.data.label ?? ''"
                  (change)="setNodeLabel(sel.id, sel.data, $event)"
                />
              </label>

              @if (sel.data.shape === 'box') {
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
              } @else if (sel.data.shape !== 'background-image') {
                <label class="field">
                  <span>Color</span>
                  <input
                    type="color"
                    [value]="sel.data.color ?? '#03a9f4'"
                    (change)="setNodeColor(sel.id, sel.data, $event)"
                  />
                </label>
              }

              @if (sel.data.shape === 'box-ports') {
                <div class="ports-editor">
                  <span class="ports-group-label">Inputs</span>
                  @for (port of sel.data.ports; track port.id) {
                    @if (port.direction === 'in') {
                      <div class="port-edit-row">
                        <div class="port-fields">
                          <input
                            class="text"
                            placeholder="Label"
                            [value]="port.label"
                            (change)="updatePortLabel(sel.id, sel.data, port.id, $event)"
                          />
                          <select
                            class="text port-type-select"
                            (change)="setPortType(sel.id, sel.data, port.id, $event)"
                          >
                            <option value="" [selected]="!port.type">—</option>
                            <optgroup label="Wire">
                              @for (t of wireTypes; track t) {
                                <option [value]="t" [selected]="port.type === t">{{ t }}</option>
                              }
                            </optgroup>
                            @for (group of connectionTypes.groups(); track group.group) {
                              <optgroup [label]="group.label">
                                @for (t of group.types; track t.key) {
                                  <option [value]="t.key" [selected]="port.type === t.key">{{ t.label }}</option>
                                }
                              </optgroup>
                            }
                          </select>
                        </div>
                        <div class="port-actions">
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
                      </div>
                    }
                  }
                  <button class="btn secondary" (click)="addPort(sel.id, sel.data, 'in')">+ Input port</button>

                  <span class="ports-group-label">Outputs</span>
                  @for (port of sel.data.ports; track port.id) {
                    @if (port.direction === 'out') {
                      <div class="port-edit-row">
                        <div class="port-fields">
                          <input
                            class="text"
                            placeholder="Label"
                            [value]="port.label"
                            (change)="updatePortLabel(sel.id, sel.data, port.id, $event)"
                          />
                          <select
                            class="text port-type-select"
                            (change)="setPortType(sel.id, sel.data, port.id, $event)"
                          >
                            <option value="" [selected]="!port.type">—</option>
                            <optgroup label="Wire">
                              @for (t of wireTypes; track t) {
                                <option [value]="t" [selected]="port.type === t">{{ t }}</option>
                              }
                            </optgroup>
                            @for (group of connectionTypes.groups(); track group.group) {
                              <optgroup [label]="group.label">
                                @for (t of group.types; track t.key) {
                                  <option [value]="t.key" [selected]="port.type === t.key">{{ t.label }}</option>
                                }
                              </optgroup>
                            }
                          </select>
                        </div>
                        <div class="port-actions">
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
                      </div>
                    }
                  }
                  <button class="btn secondary" (click)="addPort(sel.id, sel.data, 'out')">+ Output port</button>
                </div>
              }

              @if (sel.data.shape !== 'background-image') {
                <div class="link-section">
                  @if (sel.data.link; as link) {
                    @if (link.kind === 'image') {
                      <div class="link-image">
                        <img
                          class="link-thumb"
                          [src]="linkImageUrl(link.attachmentId)"
                          alt=""
                          title="Open image"
                          (click)="openImage(link.attachmentId)"
                        />
                        <button
                          type="button"
                          class="link-image-remove"
                          title="Remove link"
                          (click)="removeLink(sel.id, sel.data)"
                        >
                          <app-icon [path]="icons.close" [size]="14" />
                        </button>
                      </div>
                    } @else {
                      <div class="link-chip">
                        <button type="button" class="link-chip-main" (click)="openLinkedEntity(link)">
                          <app-icon [path]="linkIcon(link.kind)" [size]="16" />
                          <span>{{ linkedEntityName(link) }}</span>
                        </button>
                        <button
                          type="button"
                          class="link-chip-remove"
                          title="Remove link"
                          (click)="removeLink(sel.id, sel.data)"
                        >
                          <app-icon [path]="icons.close" [size]="14" />
                        </button>
                      </div>
                    }
                  } @else {
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
                    <button class="btn secondary" (click)="openPicker({ kind: 'link-connection', nodeId: sel.id })">
                      <app-icon [path]="icons.connection" [size]="16" /> Link to connection
                    </button>
                  }
                </div>
              }

              <button class="btn secondary lock-button" (click)="toggleLocked(sel.id, sel.locked)">
                <app-icon [path]="sel.locked ? icons.locked : icons.unlocked" [size]="16" />
                {{ sel.locked ? 'Locked — click to unlock' : 'Lock in place' }}
              </button>
            } @else {
              <h3>Connection</h3>
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
              <label class="field">
                <span>Type</span>
                <select class="text" (change)="setEdgeType(sel.id, $event)">
                  <option value="" [selected]="!sel.data.type">—</option>
                  <optgroup label="Wire">
                    @for (t of wireTypes; track t) {
                      <option [value]="t" [selected]="sel.data.type === t">{{ t }}</option>
                    }
                  </optgroup>
                  @for (group of connectionTypes.groups(); track group.group) {
                    <optgroup [label]="group.label">
                      @for (t of group.types; track t.key) {
                        <option [value]="t.key" [selected]="sel.data.type === t.key">{{ t.label }}</option>
                      }
                    </optgroup>
                  }
                </select>
              </label>
              <div class="field">
                <span>Color</span>
                <div class="wire-color-row">
                  <input
                    type="color"
                    class="wire-color-input"
                    [value]="sel.data.color || '#9e9e9e'"
                    (change)="setEdgeColorFromInput(sel.id, $event)"
                    title="Custom color"
                  />
                  @if (sel.data.color) {
                    <button
                      type="button"
                      class="btn icon-only"
                      title="Clear color"
                      (click)="setEdgeColor(sel.id, undefined)"
                    >
                      <app-icon [path]="icons.close" [size]="14" />
                    </button>
                  }
                </div>
              </div>
              @if (sel.data.connectionId; as connectionId) {
                <div class="link-chip">
                  <button type="button" class="link-chip-main" (click)="openConnectionDevice(connectionId)">
                    <app-icon [path]="icons.connection" [size]="16" />
                    <span>{{ connectionLabel(connectionId) }}</span>
                  </button>
                  <button
                    type="button"
                    class="link-chip-remove"
                    title="Remove link"
                    (click)="removeEdgeConnection(sel.id, sel.data)"
                  >
                    <app-icon [path]="icons.close" [size]="14" />
                  </button>
                </div>
              } @else {
                <button class="btn secondary" (click)="openPicker({ kind: 'edge-connection', edgeId: sel.id })">
                  <app-icon [path]="icons.connection" [size]="16" /> Link to connection
                </button>
              }
              @if (sel.routingMode === 'manual') {
                <button class="btn secondary" (click)="resetEdgeRouting(sel.id)">
                  Reset routing
                </button>
              }
            }
          </div>
        }
      }
    </div>

    <dialog #deviceDlg class="device-picker-dialog" (cancel)="pickerTarget.set(null)">
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
      [open]="
        pickerTarget()?.kind === 'edge-connection' || pickerTarget()?.kind === 'link-connection'
      "
      [connections]="connections()"
      [contextDeviceIds]="connectionContextDeviceIds()"
      [contextDevicePair]="connectionContextDevicePair()"
      [contextDevice]="connectionContextSingleDevice()"
      [contextLabel]="connectionContextLabel()"
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
         definite parent height — min-height alone doesn't count.
         dvh (not vh) so mobile browser chrome collapsing/expanding doesn't
         leave the canvas measured against a viewport taller than what's
         actually visible. */
      height: calc(100vh - 160px);
      height: calc(100dvh - 160px);
      min-height: 320px;
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
    .zoom-reset-overlay {
      bottom: 12px;
      left: 12px;
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
    .layout-toggle {
      display: flex;
      gap: 4px;
    }
    .layout-toggle .btn {
      flex: 1;
      justify-content: center;
    }
    .row-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .row-buttons .btn {
      flex: 1 1 auto;
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
      flex-direction: column;
      gap: 4px;
    }
    .port-fields {
      display: flex;
      gap: 4px;
    }
    .port-fields .text {
      flex: 1 1 0;
      min-width: 0;
    }
    .port-actions {
      display: flex;
      gap: 4px;
      justify-content: flex-end;
    }
    .wire-color-row {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .wire-color-input {
      width: 28px;
      height: 22px;
      padding: 0;
      border: none;
      background: none;
      cursor: pointer;
    }
    .link-chip {
      display: flex;
      align-items: stretch;
      gap: 1px;
      align-self: flex-start;
      max-width: 100%;
      border-radius: 16px;
      background: var(--chip-background-color);
      overflow: hidden;
    }
    .link-chip-main {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      border: none;
      background: none;
      color: var(--primary-text-color);
      font: inherit;
      font-size: 13px;
      padding: 6px 6px 6px 12px;
      cursor: pointer;
    }
    .link-chip-main span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .link-chip-remove {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 28px;
      border: none;
      background: none;
      color: var(--secondary-text-color);
      cursor: pointer;
    }
    .link-chip-remove:hover {
      background: var(--hover-color);
      color: var(--primary-text-color);
    }
    .link-image {
      position: relative;
    }
    .link-thumb {
      display: block;
      width: 100%;
      max-height: 140px;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid var(--divider-color);
      cursor: pointer;
    }
    .link-image-remove {
      position: absolute;
      top: 6px;
      right: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.6);
      color: #fff;
      cursor: pointer;
    }
    .link-image-remove:hover {
      background: rgba(0, 0, 0, 0.8);
    }
    .lock-button {
      width: 100%;
      justify-content: flex-start;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
    .device-picker-dialog {
      /* app-device-picker's results dropdown is an absolutely-positioned
         overlay, so it doesn't grow the dialog's own auto-height like the
         other pickers' in-flow lists do — reserve real room up front so a
         modal <dialog>'s forced overflow:auto (Chromium) doesn't clip it. */
      min-height: min(70vh, 480px);
    }
    @media (max-width: 640px) {
      .panel {
        /* A full-width, top-anchored panel used to blanket the whole canvas,
           leaving nothing to tap through to. Pin it to the bottom instead,
           capped well under half the canvas height, so the diagram itself
           stays visible and interactive above it. */
        left: 12px;
        right: 12px;
        top: auto;
        bottom: 12px;
        width: auto;
        max-height: 45%;
      }
      .canvas-wrap {
        /* The header wraps to multiple lines at this width, eating into the
           160px budget above — give the canvas a fixed, generous floor
           instead of trusting the desktop-tuned offset. */
        height: 70dvh;
        min-height: 280px;
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
  protected readonly connectionTypes = inject(ConnectionTypesStore);
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
    ['background-image', BackgroundImageNodeComponent],
  ]);
  protected readonly edgeTemplateMap = new NgDiagramEdgeTemplateMap([['wire', WireEdgeComponent]]);
  protected readonly wireTypes = WIRE_TYPES;
  protected readonly model = signal<ModelAdapter | null>(null);
  /** Diagrams open read-only; "Edit" unlocks dragging/resizing/linking and the
   *  editing toolbar, "Save" persists and locks it back down. Clicking a
   *  linked node while read-only navigates to the link immediately instead
   *  of selecting it. */
  protected readonly readOnly = signal(true);
  protected readonly title = signal('');
  protected readonly saving = signal(false);
  protected readonly dirty = signal(false);
  /** Public (unlike dirty/readOnly themselves) so the routed page component
   *  can read it for its CanDeactivate guard — see diagrams-deactivate.guard.ts. */
  readonly hasUnsavedChanges = computed(() => !this.readOnly() && this.dirty());
  protected readonly propertiesOpen = signal(false);
  protected readonly pickerTarget = signal<PickerTarget | null>(null);
  protected readonly imageAttachments = signal<AttachmentDto[]>([]);
  protected readonly siblingDiagrams = signal<DiagramDto[]>([]);
  protected readonly connections = signal<ConnectionDto[]>([]);
  /** Device id(s) behind whatever's being linked — an edge's two device-linked
   *  endpoints, or a node's own linked device — so the connection picker can
   *  float likely matches to the top. Not reactive to model edits mid-picker
   *  (recomputed only when the picker target itself changes), which is fine:
   *  the model can't change while a picker dialog is open. */
  protected readonly connectionContextDeviceIds = computed<string[]>(() => {
    const target = this.pickerTarget();
    if (!target) return [];
    if (target.kind === 'edge-connection') {
      const edge = this.modelService.getEdgeById(target.edgeId);
      if (!edge) return [];
      const sourceData = this.modelService.getNodeById<NodeData>(edge.source)?.data;
      const targetData = this.modelService.getNodeById<NodeData>(edge.target)?.data;
      const ids: string[] = [];
      if (sourceData?.link?.kind === 'device') ids.push(sourceData.link.deviceId);
      if (targetData?.link?.kind === 'device') ids.push(targetData.link.deviceId);
      return ids;
    }
    if (target.kind === 'link-connection') {
      const data = this.modelService.getNodeById<NodeData>(target.nodeId)?.data;
      return data?.link?.kind === 'device' ? [data.link.deviceId] : [];
    }
    return [];
  });
  /** Both ends of the edge being linked, resolved to full devices, when both
   *  are device-linked nodes — lets the connection picker pre-fill "Create
   *  new connection" outright instead of making you pick both devices again. */
  protected readonly connectionContextDevicePair = computed<[DeviceDto, DeviceDto] | null>(() => {
    const target = this.pickerTarget();
    if (target?.kind !== 'edge-connection') return null;
    const edge = this.modelService.getEdgeById(target.edgeId);
    if (!edge) return null;
    const sourceLink = this.modelService.getNodeById<NodeData>(edge.source)?.data.link;
    const targetLink = this.modelService.getNodeById<NodeData>(edge.target)?.data.link;
    if (sourceLink?.kind !== 'device' || targetLink?.kind !== 'device') return null;
    const fromDevice = this.devices().find((d) => d.id === sourceLink.deviceId);
    const toDevice = this.devices().find((d) => d.id === targetLink.deviceId);
    return fromDevice && toDevice ? [fromDevice, toDevice] : null;
  });
  /** The node's own linked device, resolved, when linking a node rather than
   *  an edge — same pre-fill convenience as connectionContextDevicePair. */
  protected readonly connectionContextSingleDevice = computed<DeviceDto | null>(() => {
    const target = this.pickerTarget();
    if (target?.kind !== 'link-connection') return null;
    const link = this.modelService.getNodeById<NodeData>(target.nodeId)?.data.link;
    if (link?.kind !== 'device') return null;
    return this.devices().find((d) => d.id === link.deviceId) ?? null;
  });
  /** The wire's own label, when linking an edge — pre-fills "Create new
   *  connection" so the two don't drift apart into separately-worded labels. */
  protected readonly connectionContextLabel = computed<string>(() => {
    const target = this.pickerTarget();
    if (target?.kind !== 'edge-connection') return '';
    return this.modelService.getEdgeById<EdgeData>(target.edgeId)?.data?.label ?? '';
  });
  /** Device links aren't scoped to this diagram's area/device (the picker
   *  searches all devices), so resolving a linked device's name needs the
   *  full list rather than something already loaded for this page. */
  protected readonly devices = signal<DeviceDto[]>([]);
  /** Same reasoning as `devices` — area links aren't scoped to this diagram. */
  protected readonly areas = signal<AreaDto[]>([]);
  protected readonly selection = signal<
    | { kind: 'node'; id: string; data: NodeData; locked: boolean }
    | {
        kind: 'edge';
        id: string;
        data: EdgeData;
        sourceArrowhead?: string;
        targetArrowhead?: string;
        routingMode?: 'manual' | 'auto';
      }
    | null
  >(null);

  /** While locked (the default), a background-image node can't be clicked/selected
   *  directly on canvas — its settings live in Diagram properties instead. */
  protected readonly backgroundImage = computed(() =>
    this.modelService
      .nodes()
      .find((n) => (n.data as NodeData).shape === 'background-image') as NgNode<NodeData> | undefined
  );

  protected readonly icons = {
    dot: mdiCircleOutline,
    shape: mdiShapeOutline,
    ports: mdiElectricSwitch,
    area: mdiFloorPlan,
    device: mdiDevices,
    connection: mdiTransitConnectionVariant,
    link: mdiLinkVariant,
    image: mdiImagePlus,
    delete: mdiDelete,
    save: mdiContentSave,
    edit: mdiPencil,
    open: mdiOpenInNew,
    locked: mdiLock,
    unlocked: mdiLockOpenVariantOutline,
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
  /** Viewport to restore once <ng-diagram> mounts and fires diagramInit — set by load(), consumed there. */
  private pendingViewport: DiagramViewport | null = null;
  private viewportSaveTimer: ReturnType<typeof setTimeout> | null = null;
  /** Nodes/edges exactly as last loaded from the server — used (untouched) as
   *  the base for a viewport-only save (see persistViewport()). The live
   *  model's nodes are NOT a safe source for that: load() overwrites every
   *  node's draggable/resizable to false while read-only, purely as a
   *  cosmetic "no drag handles while viewing" cue — reading that back out via
   *  toContent() would silently persist the override as real data. */
  private lastLoadedContent: DiagramContent | null = null;

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
    if (this.viewportSaveTimer) clearTimeout(this.viewportSaveTimer);
  }

  /** Covers tab close/refresh/address-bar navigation — CanDeactivate (see
   *  diagrams-deactivate.guard.ts) only catches in-app router navigation. */
  @HostListener('window:beforeunload', ['$event'])
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = true;
  }

  protected hasImageSource(): boolean {
    return this.imageAttachments().length > 0;
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
      this.lastLoadedContent = d.content;
      // A freshly opened, still-empty diagram (just created) starts in edit
      // mode — there's nothing to view read-only, and you're about to draw
      // on it anyway. Only on the initial open of this diagram id, so this
      // can't fight enterEditMode()/saveAndExitEditMode()'s own state changes.
      if (isInitialOpen && d.content.nodes.length === 0) {
        this.readOnly.set(false);
      }
      this.pendingViewport = d.content.viewport ?? null;
      queueMicrotask(() => {
        const readOnly = this.readOnly();
        const m = initializeModel(
          {
            nodes: d.content.nodes.map((n) =>
              readOnly ? { ...n, draggable: false, resizable: false } : n
            ),
            edges: d.content.edges.map((e) => ({ ...e, type: e.type ?? 'wire', data: e.data ?? {} })),
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
      linking: {
        validateConnection: () => !this.readOnly(),
        // Every hand-drawn edge gets the colorable 'wire' template — matches
        // loaded edges, which default to it too (see load()). Arrowheads are
        // opt-in (see setEdgeArrowhead()) — clear whatever the library
        // defaults a freshly drawn edge to.
        finalEdgeDataBuilder: (edge: NgEdge) => ({
          ...edge,
          type: 'wire',
          sourceArrowhead: undefined,
          targetArrowhead: undefined,
        }),
      },
    });

    if (this.pendingViewport) {
      const { x, y, scale } = this.pendingViewport;
      this.viewportService.setViewport(x, y, scale);
      this.pendingViewport = null;
    } else if ((this.model()?.getNodes().length ?? 0) > 0) {
      this.viewportService.zoomToFit();
    }
    this.model()?.onChange(() => {
      this.dirty.set(true);
      // Reshaping (and any other direct model write) bypasses this component's
      // own setters, so the property panel's snapshot of the selected edge
      // (routingMode in particular — it gates the "Reset routing" button)
      // would otherwise go stale until the user deselects and reselects it.
      const sel = this.selection();
      if (sel?.kind === 'edge') {
        const live = this.modelService.getEdgeById(sel.id);
        if (live) {
          this.selection.set({
            kind: 'edge',
            id: live.id,
            data: (live.data ?? {}) as EdgeData,
            sourceArrowhead: live.sourceArrowhead,
            targetArrowhead: live.targetArrowhead,
            routingMode: live.routingMode,
          });
        }
      }
    });
  }

  protected onSelectionChanged(event: SelectionChangedEvent): void {
    if (event.selectedNodes.length === 1 && event.selectedEdges.length === 0) {
      const n = event.selectedNodes[0];
      const data = n.data as NodeData;
      if (data.shape === 'background-image' && n.draggable === false) {
        // A locked backdrop image isn't meant to be clickable — bounce the
        // selection away; unlock it from the Diagram properties panel instead.
        this.selectionService.deselect([n.id]);
        this.selection.set(null);
        return;
      }
      if (this.readOnly()) {
        // No properties panel while read-only — everything in it duplicates
        // what's already visible on the canvas, so a click jumps straight
        // to whatever the node links to instead.
        if (data.link) this.openLinkedEntity(data.link);
        return;
      }
      this.selection.set({ kind: 'node', id: n.id, data, locked: n.draggable === false });
      // Both panels are full-width bottom sheets on mobile — showing them
      // together would just stack one on top of the other.
      this.propertiesOpen.set(false);
    } else if (event.selectedEdges.length === 1 && event.selectedNodes.length === 0) {
      const e = event.selectedEdges[0];
      if (this.readOnly()) {
        const connectionId = (e.data as EdgeData | undefined)?.connectionId;
        if (connectionId) this.openConnectionDevice(connectionId);
        return;
      }
      this.selection.set({
        kind: 'edge',
        id: e.id,
        data: (e.data ?? {}) as EdgeData,
        sourceArrowhead: e.sourceArrowhead,
        targetArrowhead: e.targetArrowhead,
        routingMode: e.routingMode,
      });
      this.propertiesOpen.set(false);
    } else {
      this.selection.set(null);
    }
  }

  /** A node/edge drag re-anchors any manually-reshaped wire touching a moved
   *  node — auto-routed wires are already re-routed by ng-diagram itself. Mid-drag
   *  (no merge) so the route isn't simplified before the user drops it. */
  protected onSelectionMoved(event: SelectionMovedEvent): void {
    applyEdgeStretchOnSelectionMoved(this.modelService, new Set(event.nodes.map((n) => n.id)), false);
  }

  /** On drop: fold whatever bends the drag left collinear, once. */
  protected onNodeDragEnded(event: NodeDragEndedEvent): void {
    applyEdgeStretchOnSelectionMoved(this.modelService, new Set(event.nodes.map((n) => n.id)), true);
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
    this.propagateTypeOnDraw(event);
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
      const existing = (event.edge.data ?? {}) as EdgeData;
      this.modelService.updateEdgeData(event.edge.id, {
        ...existing,
        connectionId: match.id,
        label: existing.label || match.label || undefined,
      });
      this.applyConnectionTypeToEdge(event.edge.id, match.type);
      this.toast.info(`Linked to connection ${match.fromDeviceName} → ${match.toDeviceName}`);
    }
  }

  /** Drawing a wire from a typed port with no type yet copies the port's type
   *  onto the wire; dropping it on a typed-less port then copies the
   *  (possibly just-set) type onto that port. Existing types are never
   *  overwritten — this only fills gaps at creation time. */
  private propagateTypeOnDraw(event: EdgeDrawEndedEvent): void {
    if (!event.edge || !event.target) return;
    const sourcePort = this.findPort(event.source.data as NodeData, event.sourcePort);
    const targetPort = this.findPort(event.target.data as NodeData, event.targetPort);
    const edgeData = (event.edge.data ?? {}) as EdgeData;
    let value = edgeData.type;
    if (!value && sourcePort?.type) {
      value = sourcePort.type;
      this.modelService.updateEdgeData(event.edge.id, {
        ...edgeData,
        type: value,
        color: wireOrCableColor(value, this.connectionTypes) ?? edgeData.color,
      });
    }
    if (targetPort && !targetPort.type && value) {
      const targetData = event.target.data as BoxPortsNodeData;
      this.modelService.updateNodeData(event.target.id, {
        ...targetData,
        ports: targetData.ports.map((p) => (p.id === targetPort.id ? { ...p, type: value } : p)),
      });
    }
  }

  private findPort(data: NodeData, portId: string | undefined): NodePort | undefined {
    if (!portId || data.shape !== 'box-ports') return undefined;
    return data.ports.find((p) => p.id === portId);
  }

  /** Resets scale to 100% — x/y are the viewport center's own coordinates (per
   *  ng-diagram's Viewport type), so keeping them as-is keeps the same point centered. */
  protected resetZoom(): void {
    const v = this.viewportService.viewport();
    this.viewportService.setViewport(v.x, v.y, 1);
  }

  /** In read-only (view) mode there's no edit/save flow to piggyback on, so
   *  pan/zoom is persisted directly, debounced (see currentSaveableContent()
   *  for what actually gets sent — never the live model while merely
   *  viewing). In edit mode the viewport rides along with the next explicit
   *  Save instead (see saveAndExitEditMode()), so an in-progress edit is
   *  never silently committed. */
  protected onViewportChanged(event: ViewportChangedEvent): void {
    if (!this.readOnly()) return;
    if (this.viewportSaveTimer) clearTimeout(this.viewportSaveTimer);
    const viewport = event.viewport;
    this.viewportSaveTimer = setTimeout(() => this.persistViewport(viewport), 800);
  }

  private persistViewport(viewport: DiagramViewport): void {
    const content = this.currentSaveableContent(viewport);
    if (!content) return;
    this.api.putContent(this.diagramId(), this.version, content).subscribe({
      next: (updated) => {
        this.version = updated.version;
        this.lastLoadedContent = content;
      },
      error: () => {
        // Best-effort — a missed viewport save isn't worth surfacing to the user.
      },
    });
  }

  /**
   * The content to persist right now — the ONE place that decides which
   * source of truth to read from, so a future save path can't accidentally
   * repeat the mistake this fixed: while merely viewing (readOnly), the live
   * model's nodes carry a cosmetic draggable/resizable override (see the
   * readOnly branch in load()) purely to hide drag/resize handles — reading
   * that back out as real data is exactly how a node lost its dragability
   * permanently. Nothing else could have legitimately changed while just
   * viewing, so this returns the pristine last-loaded snapshot instead. While
   * editing, the live model IS the source of truth for whatever's in progress.
   */
  private currentSaveableContent(viewport?: DiagramViewport): DiagramContent | null {
    if (this.readOnly()) {
      if (!this.lastLoadedContent) return null;
      return viewport ? { ...this.lastLoadedContent, viewport } : this.lastLoadedContent;
    }
    const model = this.model();
    if (!model) return null;
    return toContent(model.getNodes(), model.getEdges(), viewport ?? this.viewportService.viewport());
  }

  private nextPosition() {
    const v = this.viewportService.viewport();
    this.addCount++;
    return { x: v.x + (this.addCount % 5) * 30, y: v.y + Math.floor(this.addCount / 5) * 30 };
  }

  /** crypto.randomUUID() only exists in secure contexts (HTTPS/localhost) — fall back on plain HTTP LAN access. */
  private generateId(): string {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 15)}`;
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
            // No label by default — box-ports-node.component.ts falls back
            // to displaying "Switch box" on the canvas when it's unset.
            ports: [
              { id: this.generateId(), label: 'In 1', direction: 'in' },
              { id: this.generateId(), label: 'Out 1', direction: 'out' },
            ],
          }
        : // No label by default here either — dot-node/box-node fall back to
          // "Marker"/"Box" on the canvas, which leaves the label free to be
          // set from a linked entity's name instead of overwriting a placeholder.
          { shape, color: '#03a9f4' };
    this.modelService.addNodes([{ id: this.generateId(), type: shape, position: this.nextPosition(), data }]);
  }

  protected addPort(nodeId: string, data: BoxPortsNodeData, direction: PortDirection): void {
    const port: NodePort = { id: this.generateId(), label: '', direction };
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

  /**
   * One picker covers both granularities — an individual conductor
   * (L1/L2/L3/N/PE/DC+/DC-) or a whole cable (230V mains, 24V/12V DC, USB,
   * Ethernet, Zigbee, ...) — a single `type` field, since the UI only ever
   * lets you pick one value from one list anyway. Setting it colors the pin
   * once (an edge's/port's own color can then be changed independently) and
   * cascades to whatever's connected — see cascadeTypeFromPort().
   */
  protected setPortType(nodeId: string, data: BoxPortsNodeData, portId: string, event: Event): void {
    const value = (event.target as HTMLSelectElement).value as WireOrCableType | '';
    const type = value || undefined;
    const oldType = data.ports.find((p) => p.id === portId)?.type;
    this.updateSelectedNodeData(nodeId, {
      ...data,
      ports: data.ports.map((p) => (p.id === portId ? { ...p, type } : p)),
    });
    this.cascadeTypeFromPort(nodeId, portId, oldType, type);
    this.refreshSelectionIfNode(nodeId);
  }

  /** A cascade can touch a port on the currently-selected node other than the
   *  one just edited (e.g. two of its ports are connected to each other) —
   *  re-sync the panel's snapshot from the model so it doesn't show stale data. */
  private refreshSelectionIfNode(nodeId: string): void {
    const sel = this.selection();
    if (sel?.kind !== 'node' || sel.id !== nodeId) return;
    const fresh = this.modelService.getNodeById<NodeData>(nodeId);
    if (fresh) this.selection.set({ ...sel, data: fresh.data });
  }

  /** Linking (or auto-linking, see onEdgeDrawEnded()) an edge to a real
   *  Connection copies the connection's type onto the wire when it doesn't
   *  have one yet, then propagates it to connected ports the same way
   *  manually setting a type does — see cascadeTypeFromEdge(). */
  private applyConnectionTypeToEdge(edgeId: string, connectionType: ConnectionType): void {
    const data = (this.modelService.getEdgeById<EdgeData>(edgeId)?.data ?? {}) as EdgeData;
    if (data.type) return;
    this.modelService.updateEdgeData(edgeId, {
      ...data,
      type: connectionType,
      color: wireOrCableColor(connectionType, this.connectionTypes) ?? data.color,
    });
    this.cascadeTypeFromEdge(edgeId, undefined, connectionType);
  }

  /**
   * A port/wire type change cascades through directly-connected wires/ports
   * that shared the OLD value, so a matching chain stays in sync — e.g.
   * given `L --- L ---> N` (a mismatch at the receiving end), changing either
   * L updates the other L too, but the mismatched N is left alone since it
   * never matched in the first place. Stops at the first mismatch in each
   * direction rather than forcing every connected element to one value.
   */
  private cascadeTypeFromPort(
    nodeId: string,
    portId: string,
    oldType: WireOrCableType | undefined,
    newType: WireOrCableType | undefined
  ): void {
    if (oldType === newType) return;
    this.propagateFromPort(nodeId, portId, oldType, newType, new Set([`${nodeId}:${portId}`]), new Set());
  }

  private cascadeTypeFromEdge(
    edgeId: string,
    oldType: WireOrCableType | undefined,
    newType: WireOrCableType | undefined
  ): void {
    if (oldType === newType) return;
    this.propagateFromEdge(edgeId, oldType, newType, new Set(), new Set([edgeId]));
  }

  private propagateFromPort(
    nodeId: string,
    portId: string,
    oldType: WireOrCableType | undefined,
    newType: WireOrCableType | undefined,
    visitedPorts: Set<string>,
    visitedEdges: Set<string>
  ): void {
    for (const edge of this.modelService.edges()) {
      if (visitedEdges.has(edge.id)) continue;
      const touchesPort =
        (edge.source === nodeId && edge.sourcePort === portId) ||
        (edge.target === nodeId && edge.targetPort === portId);
      if (!touchesPort) continue;
      const edgeData = edge.data as EdgeData;
      if (edgeData.type !== oldType) continue;
      visitedEdges.add(edge.id);
      this.modelService.updateEdgeData(edge.id, {
        ...edgeData,
        type: newType,
        ...(newType ? { color: wireOrCableColor(newType, this.connectionTypes) ?? edgeData.color } : {}),
      });
      this.propagateFromEdge(edge.id, oldType, newType, visitedPorts, visitedEdges);
    }
  }

  private propagateFromEdge(
    edgeId: string,
    oldType: WireOrCableType | undefined,
    newType: WireOrCableType | undefined,
    visitedPorts: Set<string>,
    visitedEdges: Set<string>
  ): void {
    const edge = this.modelService.getEdgeById<EdgeData>(edgeId);
    if (!edge) return;
    const ends: Array<{ nodeId: string; portId: string | undefined }> = [
      { nodeId: edge.source, portId: edge.sourcePort },
      { nodeId: edge.target, portId: edge.targetPort },
    ];
    for (const { nodeId, portId } of ends) {
      if (!portId) continue;
      const key = `${nodeId}:${portId}`;
      if (visitedPorts.has(key)) continue;
      const node = this.modelService.getNodeById<NodeData>(nodeId);
      if (!node || node.data.shape !== 'box-ports') continue;
      const port = node.data.ports.find((p) => p.id === portId);
      if (!port || port.type !== oldType) continue;
      visitedPorts.add(key);
      this.modelService.updateNodeData(nodeId, {
        ...node.data,
        ports: node.data.ports.map((p) => (p.id === portId ? { ...p, type: newType } : p)),
      });
      this.propagateFromPort(nodeId, portId, oldType, newType, visitedPorts, visitedEdges);
    }
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

  private addBackgroundImageNode(attachment: AttachmentDto): void {
    const id = this.generateId();
    this.modelService.addNodes([
      {
        id,
        type: 'background-image',
        position: { x: 0, y: 0 },
        size: { width: 1400, height: 1000 },
        autoSize: false,
        draggable: false,
        resizable: false,
        data: {
          shape: 'background-image',
          label: attachment.title ?? attachment.originalName,
          link: { kind: 'image', attachmentId: attachment.id },
        },
      },
    ]);
    this.nodeService.sendToBack([id]);
  }

  /** Unlocks the backdrop and selects it so its own panel (with the Lock
   *  button) takes over — from there it can be dragged/resized like any
   *  other node, then locked again once positioned. */
  protected unlockBackground(node: NgNode<NodeData>): void {
    this.modelService.updateNode(node.id, { draggable: true, resizable: true });
    this.selection.set({ kind: 'node', id: node.id, data: node.data, locked: false });
    this.propertiesOpen.set(false);
  }

  protected removeBackground(node: NgNode<NodeData>): void {
    this.modelService.deleteNodes([node.id]);
    if (this.selection()?.id === node.id) this.selection.set(null);
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

  protected removeEdgeConnection(edgeId: string, data: EdgeData): void {
    const { connectionId, ...rest } = data;
    void connectionId;
    this.modelService.updateEdgeData(edgeId, rest as EdgeData);
  }

  protected onConnectionPicked(connection: ConnectionDto): void {
    const target = this.pickerTarget();
    if (!target) return;
    // Picking one just created on the spot (see connection-picker-dialog's
    // embedded "New connection" form) — it isn't in this list yet, and won't
    // be until the area/device-scoped connections effect happens to refire.
    if (!this.connections().some((c) => c.id === connection.id)) {
      this.connections.update((list) => [...list, connection]);
    }
    if (target.kind === 'edge-connection') {
      const current = this.selection();
      const existing =
        current?.kind === 'edge' && current.id === target.edgeId
          ? current.data
          : ((this.modelService.getEdgeById<EdgeData>(target.edgeId)?.data ?? {}) as EdgeData);
      this.modelService.updateEdgeData(target.edgeId, {
        ...existing,
        connectionId: connection.id,
        label: existing.label || connection.label || undefined,
      });
      this.applyConnectionTypeToEdge(target.edgeId, connection.type);
    } else if (target.kind === 'link-connection') {
      const existing = this.modelService.getNodeById<NodeData>(target.nodeId)?.data;
      if (existing) {
        this.updateSelectedNodeData(target.nodeId, {
          ...existing,
          link: { kind: 'connection', connectionId: connection.id },
          label: existing.label || this.connectionLabel(connection.id),
        });
      }
    } else {
      return;
    }
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

  protected setEdgeColor(edgeId: string, color: string | undefined): void {
    const sel = this.selection();
    if (sel?.kind !== 'edge') return;
    const data = { ...sel.data, color };
    this.modelService.updateEdgeData(edgeId, data);
    this.selection.set({ ...sel, data });
  }

  protected setEdgeColorFromInput(edgeId: string, event: Event): void {
    this.setEdgeColor(edgeId, (event.target as HTMLInputElement).value);
  }

  /** Setting a wire type applies its standard color once; clearing the type
   *  leaves whatever color is already set untouched. Either way, the color
   *  can still be changed independently afterward — see setEdgeColor(). */
  /** Edge counterpart of setPortType() — see that method for why one picker
   *  covers both the individual-wire and whole-cable granularity. */
  protected setEdgeType(edgeId: string, event: Event): void {
    const sel = this.selection();
    if (sel?.kind !== 'edge') return;
    const value = (event.target as HTMLSelectElement).value as WireOrCableType | '';
    const type = value || undefined;
    const oldType = sel.data.type;
    const data: EdgeData = {
      ...sel.data,
      type,
      ...(type ? { color: wireOrCableColor(type, this.connectionTypes) ?? sel.data.color } : {}),
    };
    this.modelService.updateEdgeData(edgeId, data);
    this.selection.set({ ...sel, data });
    this.cascadeTypeFromEdge(edgeId, oldType, type);
  }

  /** Drops any manually reshaped route and reverts to auto-routing. */
  protected resetEdgeRouting(edgeId: string): void {
    this.modelService.updateEdge(edgeId, { points: undefined, routingMode: 'auto' });
    const sel = this.selection();
    if (sel?.kind === 'edge' && sel.id === edgeId) {
      this.selection.set({ ...sel, routingMode: undefined });
    }
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

  /** The link chip is one control regardless of what it's linked to — these
   *  three dispatch to the per-kind name/icon/navigate logic above. */
  protected openLinkedEntity(link: NodeLink): void {
    switch (link.kind) {
      case 'area':
        return this.openArea(link.areaId);
      case 'device':
        return this.openDevice(link.deviceId);
      case 'diagram':
        return this.openDiagram(link.diagramId);
      case 'connection':
        return this.openConnectionDevice(link.connectionId);
      case 'image':
        return this.openImage(link.attachmentId);
    }
  }

  protected linkedEntityName(link: NodeLink): string {
    switch (link.kind) {
      case 'area':
        return this.areaName(link.areaId);
      case 'device':
        return this.deviceName(link.deviceId);
      case 'diagram':
        return this.diagramTitle(link.diagramId);
      case 'connection':
        return this.connectionLabel(link.connectionId);
      case 'image':
        return '';
    }
  }

  protected linkIcon(kind: NodeLink['kind']): string {
    switch (kind) {
      case 'area':
        return this.icons.area;
      case 'device':
        return this.icons.device;
      case 'diagram':
        return this.icons.link;
      case 'connection':
        return this.icons.connection;
      case 'image':
        return this.icons.image;
    }
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
    const content = this.currentSaveableContent();
    if (!content) return;
    this.saving.set(true);
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
      // On a slower (typically mobile) connection, node images can still be
      // in flight when toPng() walks the DOM — it snapshots whatever's
      // rendered at that instant, silently leaving unfinished images blank
      // rather than erroring, so wait for them first.
      await this.waitForImages(el);
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

  private waitForImages(root: HTMLElement): Promise<void> {
    const pending = Array.from(root.querySelectorAll('img')).filter((img) => !img.complete);
    if (pending.length === 0) return Promise.resolve();
    return Promise.all(
      pending.map(
        (img) =>
          new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            // A failed image isn't worth blocking the whole preview on.
            img.addEventListener('error', () => resolve(), { once: true });
          })
      )
    ).then(() => undefined);
  }
}
