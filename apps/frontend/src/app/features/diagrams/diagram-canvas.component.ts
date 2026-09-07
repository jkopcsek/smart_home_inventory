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
  NgDiagramPaletteItem,
  NgDiagramPaletteItemComponent,
  NgDiagramService,
  NgDiagramNodeTemplateMap,
  NgDiagramSelectionService,
  NgDiagramViewportService,
  Node as NgNode,
  NodeDragEndedEvent,
  PaletteItemDroppedEvent,
  Point,
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
  DASH_STYLES,
  DASH_STYLE_LABELS,
  DashStyle,
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
  wireOrCableDash,
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
import { ColorPickerComponent } from '../../shared/ui/color-picker.component';
import { DotNodeComponent } from './nodes/dot-node.component';
import { BoxNodeComponent } from './nodes/box-node.component';
import { ImageNodeComponent } from './nodes/image-node.component';
import { BoxPortsNodeComponent } from './nodes/box-ports-node.component';
import { BackgroundImageNodeComponent } from './nodes/background-image-node.component';
import { AnchorNodeComponent, ANCHOR_PORT_ID } from './nodes/anchor-node.component';
import { DEFAULT_BODY_COLOR, DEFAULT_BORDER_COLOR, DEFAULT_NODE_COLOR, DEFAULT_PORTS_BG_COLOR } from './nodes/node-defaults';
import { nodeIconLabel, nodeIconPath } from './nodes/node-icons';
import { WireEdgeComponent } from './edges/wire-edge.component';
import { ARROWHEAD_SIZE_TIERS, arrowheadKind, arrowheadTieredId } from './edges/arrowhead-marker';
import { AreaPickerDialogComponent } from './pickers/area-picker-dialog.component';
import { AttachmentPickerDialogComponent } from './pickers/attachment-picker-dialog.component';
import { DiagramLinkPickerDialogComponent } from './pickers/diagram-link-picker-dialog.component';
import { ConnectionPickerDialogComponent } from './pickers/connection-picker-dialog.component';
import { DevicePickerDialogComponent } from './pickers/device-picker-dialog.component';
import { IconPickerDialogComponent } from './pickers/icon-picker-dialog.component';
import { EdgeReshapeOverlayComponent } from './edge-reshaping/edge-reshape-overlay.component';
import { EdgeCommandDispatcher } from './edge-reshaping/commands';
import { EdgeReshapeHandler } from './edge-reshaping/handlers/edge-reshape.handler';
import { DiagramViewState } from './diagram-view-state.service';
import { applyEdgeStretchOnSelectionMoved } from './edge-reshaping/middleware/edge-stretch-on-move';
import {
  mdiArrangeBringToFront,
  mdiArrangeSendToBack,
  mdiArrowLeft,
  mdiChevronDown,
  mdiChevronUp,
  mdiClose,
  mdiContentSave,
  mdiDelete,
  mdiDevices,
  mdiFloorPlan,
  mdiImagePlus,
  mdiLinkVariant,
  mdiLock,
  mdiLockOpenVariantOutline,
  mdiMagnifyMinusOutline,
  mdiMagnifyPlusOutline,
  mdiMap,
  mdiOpenInNew,
  mdiPencil,
  mdiTransitConnectionVariant,
  mdiTune,
} from '@mdi/js';

type Shape = 'dot' | 'box' | 'box-ports' | 'image';

/** A freshly-added 'box' has no content to autoSize against, so it'd default
 *  to a tiny sliver — start it at roughly the footprint of a two-port
 *  'box-ports' node instead, so the two shapes read as comparable building
 *  blocks rather than one dwarfing the other. Still user-resizable after. */
const BOX_DEFAULT_SIZE = { width: 210, height: 100 };

/** Fixed footprint for a line/polyline's draggable endpoint markers — see
 *  AnchorNodeComponent. Not resizable, so this is the only place it's set. */
const ANCHOR_SIZE = { width: 14, height: 14 };

/** Clicking within this many *screen* px (converted to flow px by dividing
 *  by the current zoom, so it feels the same at any zoom level) of the
 *  line tool's last-placed point ends the chain instead of adding another
 *  point on top of it. */
const LINE_END_CLICK_SCREEN_RADIUS = 10;

/** ng-diagram-palette-item's `[item]` input defaults its generic to
 *  BasePaletteItemData, which requires a `label: string` — our node data has
 *  no such field (label is optional, shown on the node itself, not the
 *  palette item), so the structural type never lines up. One cast, localized
 *  here, instead of sprinkling `as unknown` through the template data. */
function nodePaletteItem(
  type: Shape,
  data: NodeData,
  overrides?: { size?: { width: number; height: number }; autoSize?: boolean }
): NgDiagramPaletteItem {
  return { type, data, ...overrides } as unknown as NgDiagramPaletteItem;
}

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
  | { kind: 'set-image'; nodeId: string }
  | { kind: 'add-image-node' }
  | { kind: 'edge-connection'; edgeId: string }
  | { kind: 'node-icon'; nodeId: string };


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
      zOrder: n.zOrder,
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
      zOrder: e.zOrder,
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
  providers: [provideNgDiagram(), EdgeCommandDispatcher, EdgeReshapeHandler, DiagramViewState],
  imports: [
    NgDiagramComponent,
    NgDiagramBackgroundComponent,
    NgDiagramMarkerComponent,
    NgDiagramMinimapComponent,
    NgDiagramPaletteItemComponent,
    IconComponent,
    ColorPickerComponent,
    AreaPickerDialogComponent,
    AttachmentPickerDialogComponent,
    DiagramLinkPickerDialogComponent,
    ConnectionPickerDialogComponent,
    DevicePickerDialogComponent,
    IconPickerDialogComponent,
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
          (paletteItemDropped)="onPaletteItemDropped($event)"
        >
          <ng-diagram-background type="dots" />
        </ng-diagram>
        <!-- NOT nested inside <ng-diagram> — its own template projects only
             ng-diagram-background-selected content, so anything else placed
             inside it (this included) silently never mounts and its marker
             never actually registers. Registration only needs this
             component to render somewhere, not to be inside <ng-diagram>
             itself — see MarkerRegistryService, a plain root-provided
             singleton keyed by marker id. -->
        <ng-diagram-marker>
          <svg>
            <defs>
              <!-- markerUnits="userSpaceOnUse" — the SVG default (strokeWidth)
                   scales the marker 1:1 with the edge's stroke-width, which
                   blew the arrowhead up way past readable at the thick end
                   of the width picker (see setEdgeWidth). A fixed size looks
                   disconnected from the line at the other end though, so
                   three explicit size tiers stand in for true proportional
                   scaling — sm/md/lg, picked per-edge by the edge's own
                   width and baked directly into its stored sourceArrowhead/
                   targetArrowhead (see arrowhead-marker.ts; ng-diagram
                   resolves an edge's marker straight from that field, so a
                   template-level size override alone would get shadowed).
                   Plain 'arrow'/'dot' (sized to match the '-md' tier) stay
                   registered alongside the tiered ones purely so diagrams
                   saved before this tiering existed — still holding that
                   bare id — keep resolving without a data migration. -->
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="18"
                markerHeight="18"
                markerUnits="userSpaceOnUse"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
              </marker>
              <marker
                id="dot"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="13"
                markerHeight="13"
                markerUnits="userSpaceOnUse"
              >
                <path d="M 1 5 A 4 4 0 1 0 9 5 A 4 4 0 1 0 1 5 Z" fill="context-stroke" />
              </marker>
              @for (tier of arrowheadSizeTiers; track tier.suffix) {
                <marker
                  [attr.id]="'arrow' + tier.suffix"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  [attr.markerWidth]="tier.arrow"
                  [attr.markerHeight]="tier.arrow"
                  markerUnits="userSpaceOnUse"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
                </marker>
                <marker
                  [attr.id]="'dot' + tier.suffix"
                  viewBox="0 0 10 10"
                  refX="5"
                  refY="5"
                  [attr.markerWidth]="tier.dot"
                  [attr.markerHeight]="tier.dot"
                  markerUnits="userSpaceOnUse"
                >
                  <path d="M 1 5 A 4 4 0 1 0 9 5 A 4 4 0 1 0 1 5 Z" fill="context-stroke" />
                </marker>
              }
            </defs>
          </svg>
        </ng-diagram-marker>
        <div class="overlay minimap-panel-overlay card">
          <div class="minimap-canvas" [class.collapsed]="!minimapVisible()">
            <ng-diagram-minimap position="bottom-right" [width]="180" [height]="130" [showZoomControls]="false" />
          </div>
          <div class="minimap-actions">
            @if (diagramInitialized()) {
              <button class="btn icon-only" title="Zoom out" [disabled]="!viewportService.canZoomOut()" (click)="zoomBy(-0.1)">
                <app-icon [path]="icons.zoomOut" [size]="18" />
              </button>
              <button class="btn secondary zoom-percentage" title="Reset zoom to 100%" (click)="resetZoom()">
                {{ zoomPercentage() }}%
              </button>
              <button class="btn icon-only" title="Zoom in" [disabled]="!viewportService.canZoomIn()" (click)="zoomBy(0.1)">
                <app-icon [path]="icons.zoomIn" [size]="18" />
              </button>
              <div class="v-divider"></div>
            }
            <button
              class="btn icon-only"
              [class.active-toggle]="minimapVisible()"
              title="Show/hide minimap"
              (click)="minimapVisible.set(!minimapVisible())"
            >
              <app-icon [path]="icons.minimap" [size]="18" />
            </button>
          </div>
        </div>
        @if (!readOnly()) {
          <app-edge-reshape-overlay />
          <div class="overlay palette-overlay card">
            @for (item of paletteItems; track item.shape) {
              <ng-diagram-palette-item [item]="item.paletteItem">
                <div
                  class="palette-item"
                  role="button"
                  tabindex="0"
                  [title]="'Drag onto the canvas, or click to add — ' + item.label"
                  (click)="addNode(item.shape)"
                  (keydown.enter)="addNode(item.shape)"
                  (keydown.space)="addNode(item.shape); $event.preventDefault()"
                >
                  <span class="palette-preview" [class]="'preview-' + item.shape"></span>
                  <span>{{ item.label }}</span>
                </div>
              </ng-diagram-palette-item>
            }
            <div class="h-divider"></div>
            <button
              type="button"
              class="palette-item"
              [class.active-toggle]="drawingLine()"
              [title]="
                drawingLine()
                  ? 'Click to place points, click the last point again (or Esc) to finish'
                  : 'Draw an annotation line or polyline'
              "
              (click)="toggleDrawLine()"
            >
              <span class="palette-preview preview-line"></span>
              <span>Line</span>
            </button>
          </div>
        }
        @if (drawingLine()) {
          <div
            class="overlay draw-overlay"
            role="application"
            tabindex="0"
            title="Click to place points — click the last point again (or Esc) to finish"
            (click)="onDrawClick($event)"
            (keydown.escape)="onEscapeKey()"
          ></div>
        }
      }

      <div class="overlay toolbar-overlay card">
        <button class="btn icon-only" title="Back" (click)="back.emit()">
          <app-icon [path]="icons.back" [size]="20" />
        </button>
        @if (!readOnly()) {
          <div class="v-divider"></div>
          <button
            class="btn icon-only"
            [class.active-toggle]="propertiesOpen()"
            title="Diagram properties"
            (click)="propertiesOpen.set(!propertiesOpen())"
          >
            <app-icon [path]="icons.properties" [size]="20" />
          </button>
          <div class="v-divider"></div>
          <button
            class="btn icon-only"
            title="Bring to front"
            [disabled]="!selection()"
            (click)="bringSelectionToFront()"
          >
            <app-icon [path]="icons.bringToFront" [size]="20" />
          </button>
          <button
            class="btn icon-only"
            title="Send to back"
            [disabled]="!selection()"
            (click)="sendSelectionToBack()"
          >
            <app-icon [path]="icons.sendToBack" [size]="20" />
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
        }
        <div class="v-divider"></div>
        <span class="diagram-title">{{ title() }}</span>
      </div>

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
              @if (sel.data.shape !== 'anchor') {
                <label class="field">
                  <span>Label</span>
                  <input
                    class="text"
                    [value]="sel.data.label ?? ''"
                    (change)="setNodeLabel(sel.id, sel.data, $event)"
                  />
                </label>
              }

              @if (sel.data.shape === 'box') {
                <div class="fields-inline">
                  <div class="field">
                    <span>Color</span>
                    <div class="color-with-toggle">
                      <app-color-picker
                        [disabled]="sel.data.transparent ?? false"
                        [value]="sel.data.color ?? defaultBodyColor"
                        (valueChange)="setNodeColor(sel.id, sel.data, $event)"
                      />
                      <label class="transparent-toggle" title="No fill — border only">
                        <input
                          type="checkbox"
                          [checked]="sel.data.transparent ?? false"
                          (change)="setNodeTransparent(sel.id, sel.data, $event)"
                        />
                        <span>None</span>
                      </label>
                    </div>
                  </div>
                  <label class="field">
                    <span>Border color</span>
                    <app-color-picker
                      [value]="sel.data.borderColor ?? defaultBorderColor"
                      (valueChange)="setNodeBorderColor(sel.id, sel.data, $event)"
                    />
                  </label>
                </div>
              } @else if (sel.data.shape === 'image') {
                <div class="field">
                  <span>Image</span>
                  @if (sel.data.imageAttachmentId; as attachmentId) {
                    <div class="link-image">
                      <img
                        class="link-thumb"
                        [src]="linkImageUrl(attachmentId)"
                        alt=""
                        title="Open image"
                        role="button"
                        tabindex="0"
                        (click)="openImage(attachmentId)"
                        (keydown.enter)="openImage(attachmentId)"
                      />
                      <button
                        type="button"
                        class="link-image-remove"
                        title="Remove image"
                        (click)="setNodeImageAttachment(sel.id, sel.data, null)"
                      >
                        <app-icon [path]="icons.close" [size]="14" />
                      </button>
                    </div>
                  } @else {
                    <button
                      type="button"
                      class="btn secondary"
                      (click)="openPicker({ kind: 'set-image', nodeId: sel.id })"
                    >
                      <app-icon [path]="icons.image" [size]="16" /> Set image
                    </button>
                  }
                </div>
              } @else if (sel.data.shape === 'box-ports') {
                <div class="fields-inline">
                  <label class="field">
                    <span>Border color</span>
                    <app-color-picker
                      [value]="sel.data.color ?? defaultBorderColor"
                      (valueChange)="setNodeColor(sel.id, sel.data, $event)"
                    />
                  </label>
                  <label class="field">
                    <span>Header color</span>
                    <app-color-picker
                      [value]="sel.data.headerColor ?? defaultBodyColor"
                      (valueChange)="setNodeHeaderColor(sel.id, sel.data, $event)"
                    />
                  </label>
                </div>
                <label class="field">
                  <span>Layout</span>
                  <select class="text" (change)="setBoxPortsLayout(sel.id, sel.data, $event)">
                    <option value="vertical" [selected]="(sel.data.layout ?? 'vertical') === 'vertical'">Vertical</option>
                    <option value="horizontal" [selected]="sel.data.layout === 'horizontal'">Horizontal</option>
                  </select>
                </label>
              } @else if (sel.data.shape !== 'background-image' && sel.data.shape !== 'anchor') {
                <label class="field">
                  <span>Color</span>
                  <app-color-picker
                    [value]="sel.data.color ?? defaultNodeColor"
                    (valueChange)="setNodeColor(sel.id, sel.data, $event)"
                  />
                </label>
              }

              @if (
                sel.data.shape !== 'background-image' &&
                sel.data.shape !== 'anchor' &&
                sel.data.shape !== 'image'
              ) {
                <label class="field">
                  <span>Icon</span>
                  <button
                    type="button"
                    class="icon-picker-trigger"
                    (click)="openPicker({ kind: 'node-icon', nodeId: sel.id })"
                  >
                    @if (nodeIconPath(sel.data.icon); as p) {
                      <app-icon [path]="p" [size]="16" />
                    }
                    <span>{{ nodeIconLabel(sel.data.icon) }}</span>
                  </button>
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

              @if (sel.data.shape !== 'background-image' && sel.data.shape !== 'anchor') {
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
                    @if (sel.data.shape !== 'image') {
                      <button class="btn secondary" (click)="openPicker({ kind: 'link-image', nodeId: sel.id })">
                        <app-icon [path]="icons.image" [size]="16" /> Link to image
                      </button>
                    }
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
              <div class="field">
                <div class="control-row">
                  <div class="control-col">
                    <span class="field-sublabel">Start</span>
                    <div class="arrowhead-group" role="group" aria-label="Arrowhead at start">
                      @for (opt of arrowheadOptions; track opt.label) {
                        <button
                          type="button"
                          class="arrowhead-btn"
                          [class.active]="arrowheadKind(sel.sourceArrowhead) === opt.value"
                          [title]="opt.label"
                          (click)="setEdgeArrowhead(sel.id, 'source', opt.value)"
                        >
                          <svg viewBox="0 0 24 10" width="22" height="10">
                            <line x1="1" y1="5" x2="18" y2="5" />
                            @if (opt.value === 'arrow') {
                              <path d="M 14 1 L 22 5 L 14 9 Z" fill="currentColor" stroke="none" />
                            } @else if (opt.value === 'dot') {
                              <circle cx="20" cy="5" r="3" fill="currentColor" stroke="none" />
                            }
                          </svg>
                        </button>
                      }
                    </div>
                  </div>
                  <div class="control-col">
                    <span class="field-sublabel">End</span>
                    <div class="arrowhead-group" role="group" aria-label="Arrowhead at end">
                      @for (opt of arrowheadOptions; track opt.label) {
                        <button
                          type="button"
                          class="arrowhead-btn"
                          [class.active]="arrowheadKind(sel.targetArrowhead) === opt.value"
                          [title]="opt.label"
                          (click)="setEdgeArrowhead(sel.id, 'target', opt.value)"
                        >
                          <svg viewBox="0 0 24 10" width="22" height="10">
                            <line x1="1" y1="5" x2="18" y2="5" />
                            @if (opt.value === 'arrow') {
                              <path d="M 14 1 L 22 5 L 14 9 Z" fill="currentColor" stroke="none" />
                            } @else if (opt.value === 'dot') {
                              <circle cx="20" cy="5" r="3" fill="currentColor" stroke="none" />
                            }
                          </svg>
                        </button>
                      }
                    </div>
                  </div>
                </div>
              </div>
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
                <div class="control-row">
                  <div class="control-col">
                    <span class="field-sublabel">Color</span>
                    <div class="wire-color-row">
                      <app-color-picker
                        [value]="sel.data.color || '#9e9e9e'"
                        (valueChange)="setEdgeColor(sel.id, $event)"
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
                  <div class="control-col">
                    <span class="field-sublabel">Dash style</span>
                    <div class="dash-style-group" role="group" aria-label="Dash style">
                      @for (d of dashStyles; track d) {
                        <button
                          type="button"
                          class="dash-style-btn"
                          [class.active]="(sel.data.dash ?? 'solid') === d"
                          [title]="dashStyleLabels[d]"
                          (click)="setEdgeDash(sel.id, d)"
                        >
                          <svg viewBox="0 0 24 8" width="20" height="8">
                            <line x1="1" y1="4" x2="23" y2="4" [attr.stroke-dasharray]="dashPreviewPatterns[d]" />
                          </svg>
                        </button>
                      }
                    </div>
                  </div>
                  <div class="control-col">
                    <span class="field-sublabel">Width</span>
                    <div class="width-style-group" role="group" aria-label="Line width">
                      @for (w of edgeWidths; track w) {
                        <button
                          type="button"
                          class="width-style-btn"
                          [class.active]="(sel.data.width ?? defaultEdgeWidth) === w"
                          [title]="w + 'px'"
                          (click)="setEdgeWidth(sel.id, w)"
                        >
                          <svg viewBox="0 0 24 12" width="20" height="12">
                            <line x1="1" y1="6" x2="23" y2="6" [attr.stroke-width]="w" />
                          </svg>
                        </button>
                      }
                    </div>
                  </div>
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

    <app-device-picker-dialog
      [open]="pickerTarget()?.kind === 'link-device'"
      [currentAreaId]="areaId()"
      (closed)="pickerTarget.set(null)"
      (picked)="onDevicePicked($event)"
    />

    <app-area-picker-dialog
      [open]="pickerTarget()?.kind === 'link-area'"
      [areas]="areas()"
      (closed)="pickerTarget.set(null)"
      (picked)="onAreaLinkPicked($event)"
    />
    <app-attachment-picker-dialog
      [open]="
        pickerTarget()?.kind === 'link-image' ||
        pickerTarget()?.kind === 'set-diagram-background' ||
        pickerTarget()?.kind === 'set-image' ||
        pickerTarget()?.kind === 'add-image-node'
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
      [contextType]="connectionContextType()"
      (closed)="pickerTarget.set(null)"
      (picked)="onConnectionPicked($event)"
    />
    <app-icon-picker-dialog
      [open]="pickerTarget()?.kind === 'node-icon'"
      [current]="nodeIconPickerCurrent()"
      (closed)="pickerTarget.set(null)"
      (picked)="onNodeIconPicked($event)"
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
         actually visible. 57px is the app shell's own top nav bar (56px
         min-height + 1px border) — the only chrome left above this page,
         which otherwise runs edge-to-edge (see main:has(app-diagrams-page)
         in app.ts). */
      height: calc(100vh - 57px);
      height: calc(100dvh - 57px);
      min-height: 320px;
      overflow: hidden;
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
      max-width: calc(100% - 24px);
    }
    .diagram-title {
      min-width: 0;
      padding: 0 10px 0 4px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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
    /* One panel — minimap canvas on top (collapsible), zoom controls +
       minimap toggle always visible in the footer below it — rather than
       two separately-floating overlays that would drift apart when the
       minimap is hidden. */
    .minimap-panel-overlay {
      bottom: 12px;
      right: 12px;
      display: flex;
      flex-direction: column;
      padding: 4px;
      overflow: hidden;
    }
    .minimap-canvas {
      display: grid;
      grid-template-rows: 1fr;
      transition: grid-template-rows 200ms ease;
    }
    .minimap-canvas.collapsed {
      grid-template-rows: 0fr;
    }
    /* ng-diagram-minimap normally self-positions and draws its own
       card (background/border/shadow/margin) — neutralize both so it
       just contributes its SVG content to this panel instead of nesting
       a second card inside this one. */
    .minimap-canvas ng-diagram-minimap {
      position: static;
      overflow: hidden;
      min-height: 0;
      --ngd-minimap-background: transparent;
      --ngd-minimap-border-color: transparent;
      --ngd-minimap-shadow-color: transparent;
      --ngd-minimap-border-radius: 0;
      --ngd-minimap-margin: 0;
    }
    .minimap-actions {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .zoom-percentage {
      min-width: 48px;
    }
    .palette-overlay {
      top: 60px;
      left: 12px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 6px;
    }
    .palette-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      border: none;
      background: none;
      font: inherit;
      text-align: left;
      padding: 6px 10px 6px 6px;
      border-radius: 6px;
      cursor: grab;
      font-size: 12px;
      color: var(--primary-text-color);
      /* Otherwise the browser's native drag ghost (a screenshot of this
         element under the cursor) picks up whatever text got selected by an
         accidental click-drag, instead of a clean drag image. */
      user-select: none;
    }
    .palette-item:hover {
      background: var(--hover-color);
    }
    .palette-item:active {
      cursor: grabbing;
    }
    /* Small non-interactive previews of the actual node appearance — plain
       mdi glyphs here read as "generic shape/marker/switch", not as what
       dragging the item actually produces. */
    .palette-preview {
      flex-shrink: 0;
      width: 24px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .preview-dot::before {
      content: '';
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: ${DEFAULT_NODE_COLOR};
    }
    .preview-box::before {
      content: '';
      width: 100%;
      height: 100%;
      border-radius: 4px;
      border: 2px solid ${DEFAULT_BORDER_COLOR};
      background: ${DEFAULT_BODY_COLOR};
      box-sizing: border-box;
    }
    .preview-box-ports::before {
      content: '';
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      border: 2px solid ${DEFAULT_BORDER_COLOR};
      border-radius: 3px;
      background: ${DEFAULT_PORTS_BG_COLOR};
      box-shadow:
        -5px 0 0 -4px ${DEFAULT_BORDER_COLOR},
        5px 0 0 -4px ${DEFAULT_BORDER_COLOR};
    }
    .preview-image::before {
      content: '';
      width: 100%;
      height: 100%;
      border-radius: 4px;
      border: 2px solid ${DEFAULT_BORDER_COLOR};
      background: ${DEFAULT_BODY_COLOR};
      box-sizing: border-box;
    }
    .preview-line::before {
      content: '';
      width: 20px;
      height: 2px;
      background: ${DEFAULT_NODE_COLOR};
      transform: rotate(-30deg);
    }
    .h-divider {
      height: 1px;
      background: var(--divider-color);
      margin: 2px 4px;
    }
    /* Covers the canvas while the line tool is active — clicks place points
       instead of selecting/panning, and being on top of <ng-diagram> (which
       is static-positioned, not absolute) blocks pan/zoom gestures for free.
       Lower z-index than the toolbar/palette/minimap overlays (10) so those
       stay usable — e.g. to click the Line tool again to stop drawing. */
    .draw-overlay {
      inset: 0;
      z-index: 5;
      cursor: crosshair;
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
    .color-with-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .transparent-toggle {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 12px;
      color: var(--secondary-text-color);
      cursor: pointer;
    }
    .icon-picker-trigger {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      box-sizing: border-box;
      font: inherit;
      color: var(--primary-text-color);
      background: var(--input-fill-color);
      border: 1px solid var(--divider-color);
      border-radius: 6px;
      padding: 8px 10px;
      cursor: pointer;
      text-align: left;
    }
    .icon-picker-trigger:hover {
      background: var(--hover-color);
    }
    .wire-color-row {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .dash-style-group {
      display: flex;
      gap: 2px;
      border: 1px solid var(--divider-color);
      border-radius: 6px;
      padding: 2px;
    }
    .dash-style-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 20px;
      padding: 0;
      border: none;
      border-radius: 4px;
      background: none;
      color: var(--secondary-text-color);
      cursor: pointer;
    }
    .dash-style-btn svg {
      stroke: currentColor;
      stroke-width: 2;
      fill: none;
    }
    .dash-style-btn:hover {
      background: var(--secondary-background-color);
    }
    .dash-style-btn.active {
      background: var(--accent-color);
      color: var(--text-primary-color, #fff);
    }
    .width-style-group {
      display: flex;
      gap: 2px;
      border: 1px solid var(--divider-color);
      border-radius: 6px;
      padding: 2px;
    }
    .width-style-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 20px;
      padding: 0;
      border: none;
      border-radius: 4px;
      background: none;
      color: var(--secondary-text-color);
      cursor: pointer;
    }
    .width-style-btn svg {
      stroke: currentColor;
      fill: none;
    }
    .width-style-btn:hover {
      background: var(--secondary-background-color);
    }
    .width-style-btn.active {
      background: var(--accent-color);
      color: var(--text-primary-color, #fff);
    }
    .control-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .control-col {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .field-sublabel {
      font-size: 11px;
      color: var(--secondary-text-color);
    }
    .arrowhead-group {
      display: flex;
      gap: 2px;
      border: 1px solid var(--divider-color);
      border-radius: 6px;
      padding: 2px;
    }
    .arrowhead-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 20px;
      padding: 0;
      border: none;
      border-radius: 4px;
      background: none;
      color: var(--secondary-text-color);
      cursor: pointer;
    }
    .arrowhead-btn svg {
      stroke: currentColor;
      stroke-width: 1.5;
    }
    .arrowhead-btn:hover {
      background: var(--secondary-background-color);
    }
    .arrowhead-btn.active {
      background: var(--accent-color);
      color: var(--text-primary-color, #fff);
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
  protected readonly viewportService = inject(NgDiagramViewportService);
  protected readonly zoomPercentage = computed(() => Math.round(100 * this.viewportService.scale()));
  /** viewportService's canZoomIn/canZoomOut/scale throw until this is true (same
   *  guard the library's own — now-replaced — zoom controls used internally). */
  protected readonly diagramInitialized = this.diagramService.isInitialized;
  private readonly viewState = inject(DiagramViewState);
  private readonly canvasEl = viewChild<unknown, ElementRef<HTMLElement>>('canvasEl', { read: ElementRef });

  readonly diagramId = input.required<string>();
  readonly areaId = input<string | null>(null);
  readonly deviceId = input<string | null>(null);
  readonly saved = output<DiagramDto>();
  readonly deleted = output<void>();
  readonly back = output<void>();

  protected readonly nodeTemplateMap = new NgDiagramNodeTemplateMap([
    ['dot', DotNodeComponent],
    ['box', BoxNodeComponent],
    ['box-ports', BoxPortsNodeComponent],
    ['background-image', BackgroundImageNodeComponent],
    ['anchor', AnchorNodeComponent],
    ['image', ImageNodeComponent],
  ]);
  protected readonly edgeTemplateMap = new NgDiagramEdgeTemplateMap([['wire', WireEdgeComponent]]);
  protected readonly wireTypes = WIRE_TYPES;
  protected readonly defaultNodeColor = DEFAULT_NODE_COLOR;
  protected readonly defaultBodyColor = DEFAULT_BODY_COLOR;
  protected readonly defaultBorderColor = DEFAULT_BORDER_COLOR;
  protected readonly dashStyles = DASH_STYLES;
  protected readonly dashStyleLabels = DASH_STYLE_LABELS;
  /** Scaled down for a 24x8 icon preview — DASH_STYLE_PATTERNS' coordinates
   *  are sized for real edge strokes and read as near-solid at this size. */
  protected readonly dashPreviewPatterns: Record<DashStyle, string | undefined> = {
    solid: undefined,
    dashed: '4 2',
    dotted: '1 2',
    'dash-dot': '4 2 1 2',
  };
  protected readonly edgeWidths = [1, 2, 3, 4, 6, 8];
  /** Matches ng-diagram's own unset-strokeWidth fallback (--edge-stroke-width, 2)
   *  — kept in sync here purely so the width picker highlights the right button
   *  when the edge has no explicit width set. */
  protected readonly defaultEdgeWidth = 2;
  protected readonly arrowheadSizeTiers = ARROWHEAD_SIZE_TIERS;
  /** Strips a stored marker id's size tier back to its abstract 'arrow' |
   *  'dot' kind — see arrowhead-marker.ts. Used to compare the stored value
   *  against arrowheadOptions, which only ever deals in the abstract kind. */
  protected readonly arrowheadKind = arrowheadKind;
  /** Marker ids — must match the ids registered on <ng-diagram-marker> above. */
  protected readonly arrowheadOptions: { value: string | undefined; label: string }[] = [
    { value: undefined, label: 'None' },
    { value: 'arrow', label: 'Arrow' },
    { value: 'dot', label: 'Dot' },
  ];
  protected readonly model = signal<ModelAdapter | null>(null);
  /** Diagrams open read-only; "Edit" unlocks dragging/resizing/linking and the
   *  editing toolbar, "Save" persists and locks it back down. Clicking a
   *  linked node while read-only navigates to the link immediately instead
   *  of selecting it. Backed by DiagramViewState's own signal (not a plain
   *  local one) so node templates can read the same state via DI. */
  protected readonly readOnly = this.viewState.readOnly;
  protected readonly title = signal('');
  protected readonly saving = signal(false);
  protected readonly dirty = signal(false);
  /** Public (unlike dirty/readOnly themselves) so the routed page component
   *  can read it for its CanDeactivate guard — see diagrams-deactivate.guard.ts. */
  readonly hasUnsavedChanges = computed(() => !this.readOnly() && this.dirty());
  protected readonly propertiesOpen = signal(false);
  protected readonly minimapVisible = signal(true);
  protected readonly drawingLine = signal(false);
  /** Anchors placed so far in the line/polyline currently being drawn, in
   *  click order — empty whenever the tool isn't mid-chain. */
  private lineAnchorPositions: { id: string; position: Point }[] = [];
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
  /** The wire's own type, when linking an edge — pre-fills "Create new
   *  connection"'s type so it doesn't default to the first entry in the list.
   *  Only a whole-cable ConnectionType carries over; a single-conductor
   *  WireType (L1, PE, ...) isn't a valid Connection type to preset. */
  protected readonly connectionContextType = computed<ConnectionType | ''>(() => {
    const target = this.pickerTarget();
    if (target?.kind !== 'edge-connection') return '';
    const type = this.modelService.getEdgeById<EdgeData>(target.edgeId)?.data?.type;
    if (!type || (WIRE_TYPES as readonly string[]).includes(type)) return '';
    return type as ConnectionType;
  });
  protected readonly nodeIconPickerCurrent = computed<string | undefined>(() => {
    const target = this.pickerTarget();
    if (target?.kind !== 'node-icon') return undefined;
    return this.modelService.getNodeById<NodeData>(target.nodeId)?.data?.icon;
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
    back: mdiArrowLeft,
    bringToFront: mdiArrangeBringToFront,
    sendToBack: mdiArrangeSendToBack,
    zoomIn: mdiMagnifyPlusOutline,
    zoomOut: mdiMagnifyMinusOutline,
    minimap: mdiMap,
  };
  protected readonly nodeIconPath = nodeIconPath;
  protected readonly nodeIconLabel = nodeIconLabel;
  /** Static templates for ng-diagram's own palette drag-and-drop (see
   *  PaletteDropDirective, host-bundled into <ng-diagram> itself) — dropping
   *  one creates a node with this exact data, positioned wherever it was
   *  dropped. Reused across drops as-is: box/dot's data has no per-instance
   *  fields, and box-ports' port ids only need to be unique within their own
   *  node (every lookup pairs a port id with its owning node id — see
   *  findPort/propagateFromPort below), so a fixed template is safe. */
  protected readonly paletteItems: { shape: Shape; label: string; paletteItem: NgDiagramPaletteItem }[] = [
    { shape: 'dot', label: 'Marker', paletteItem: nodePaletteItem('dot', { shape: 'dot' }) },
    {
      shape: 'box',
      label: 'Box',
      paletteItem: nodePaletteItem('box', { shape: 'box' }, { size: BOX_DEFAULT_SIZE, autoSize: false }),
    },
    {
      shape: 'box-ports',
      label: 'Box with ports',
      paletteItem: nodePaletteItem('box-ports', {
        shape: 'box-ports',
        ports: [
          { id: 'in-1', label: 'In 1', direction: 'in' },
          { id: 'out-1', label: 'Out 1', direction: 'out' },
        ],
      }),
    },
    {
      shape: 'image',
      label: 'Image',
      paletteItem: nodePaletteItem('image', { shape: 'image' }, { size: BOX_DEFAULT_SIZE, autoSize: false }),
    },
  ];

  private version = 1;
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
        dash: wireOrCableDash(value, this.connectionTypes) ?? edgeData.dash,
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

  /** Same step size and factor math as ng-diagram's own (internal, unstyleable)
   *  zoom-controls component, since ours replaces it — see zoom-controls-overlay. */
  protected zoomBy(step: number): void {
    const scale = this.viewportService.scale();
    this.viewportService.zoom((scale + step) / scale);
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

  /** Center of the currently visible canvas, in flow coordinates — where a
   *  palette click (as opposed to a drag-drop, which lands exactly under the
   *  cursor) drops a new node, so it lands somewhere visible instead of a
   *  fixed spot the user has to go hunt for. */
  private viewportCenterPosition(): Point {
    const rect = this.canvasEl()?.nativeElement.getBoundingClientRect();
    if (!rect) return this.viewportService.viewport();
    return this.viewportService.clientToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
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

  /** Click-to-add path (palette drag-and-drop bypasses this entirely — the
   *  dropped node is created directly by ng-diagram's own palette machinery,
   *  see paletteItems below). Drops the node at the center of the current
   *  viewport, so it lands somewhere visible instead of a fixed spot the
   *  user has to go hunt for. */
  protected addNode(shape: Shape): void {
    // Image nodes only make sense once an attachment is chosen — same
    // creation flow as the background image (open the picker; addImageNode
    // creates the node itself once one's picked). No empty node otherwise.
    if (shape === 'image') {
      this.pickerTarget.set({ kind: 'add-image-node' });
      return;
    }
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
        : // No label by default here either — dot/box node components fall
          // back to "Marker"/"Box" on the canvas, which leaves the label
          // free to be set from a linked entity's name instead of
          // overwriting a placeholder.
          { shape };
    const id = this.generateId();
    this.modelService.addNodes([
      {
        id,
        type: shape,
        position: this.viewportCenterPosition(),
        data,
        ...(shape === 'box' ? { size: BOX_DEFAULT_SIZE, autoSize: false } : {}),
      },
    ]);
    this.selectionService.select([id]);
  }

  /** Selects a node dropped from the palette so its properties panel opens
   *  immediately, same as addNode's click-to-add path. */
  protected onPaletteItemDropped(event: PaletteItemDroppedEvent): void {
    this.selectionService.select([event.node.id]);
  }

  protected toggleDrawLine(): void {
    if (this.drawingLine()) {
      this.endLineChain();
      return;
    }
    this.lineAnchorPositions = [];
    this.drawingLine.set(true);
  }

  /** Each click places another anchor and — once there's a previous one —
   *  a straight ('polyline' routing, i.e. no orthogonal snapping) edge
   *  connecting it to the new one. Clicking back on the last-placed anchor
   *  ends the chain instead of adding a zero-length segment there. */
  protected onDrawClick(event: MouseEvent): void {
    const position = this.viewportService.clientToFlowPosition({ x: event.clientX, y: event.clientY });
    const last = this.lineAnchorPositions[this.lineAnchorPositions.length - 1];
    const endClickRadius = LINE_END_CLICK_SCREEN_RADIUS / this.viewportService.scale();
    if (last && Math.hypot(position.x - last.position.x, position.y - last.position.y) <= endClickRadius) {
      this.endLineChain();
      return;
    }

    const id = this.generateId();
    this.modelService.addNodes([
      {
        id,
        type: 'anchor',
        position: { x: position.x - ANCHOR_SIZE.width / 2, y: position.y - ANCHOR_SIZE.height / 2 },
        size: ANCHOR_SIZE,
        autoSize: false,
        resizable: false,
        rotatable: false,
        data: { shape: 'anchor' },
      },
    ]);
    if (last) {
      this.modelService.addEdges([
        {
          id: this.generateId(),
          source: last.id,
          sourcePort: ANCHOR_PORT_ID,
          target: id,
          targetPort: ANCHOR_PORT_ID,
          type: 'wire',
          routing: 'polyline',
          data: {},
        },
      ]);
    }
    this.lineAnchorPositions.push({ id, position });
  }

  /** Escape, clicking the last-placed point again, and toggling the tool
   *  off all funnel here. A single unconnected point (no second click yet)
   *  is discarded rather than left behind as a stray, edge-less dot. */
  private endLineChain(): void {
    if (this.lineAnchorPositions.length === 1) {
      this.modelService.deleteNodes([this.lineAnchorPositions[0].id]);
    }
    this.lineAnchorPositions = [];
    this.drawingLine.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscapeKey(): void {
    if (this.drawingLine()) this.endLineChain();
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
      dash: wireOrCableDash(connectionType, this.connectionTypes) ?? data.dash,
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
        ...(newType
          ? {
              color: wireOrCableColor(newType, this.connectionTypes) ?? edgeData.color,
              dash: wireOrCableDash(newType, this.connectionTypes) ?? edgeData.dash,
            }
          : {}),
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
    } else if (target.kind === 'add-image-node') {
      this.addImageNode(attachment);
    } else if (target.kind === 'link-image') {
      const existing = this.modelService.getNodeById<NodeData>(target.nodeId)?.data;
      if (existing) {
        this.updateSelectedNodeData(target.nodeId, {
          ...existing,
          link: { kind: 'image', attachmentId: attachment.id },
          label: existing.label || attachment.title || attachment.originalName,
        });
      }
    } else if (target.kind === 'set-image') {
      const existing = this.modelService.getNodeById<NodeData>(target.nodeId)?.data;
      if (existing && existing.shape === 'image') {
        this.updateSelectedNodeData(target.nodeId, {
          ...existing,
          imageAttachmentId: attachment.id,
          label: existing.label || attachment.title || attachment.originalName,
        });
      }
    }
    this.pickerTarget.set(null);
  }

  private addImageNode(attachment: AttachmentDto): void {
    const id = this.generateId();
    this.modelService.addNodes([
      {
        id,
        type: 'image',
        position: this.viewportCenterPosition(),
        size: BOX_DEFAULT_SIZE,
        autoSize: false,
        data: {
          shape: 'image',
          imageAttachmentId: attachment.id,
          label: attachment.title ?? attachment.originalName,
        },
      },
    ]);
    this.selectionService.select([id]);
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

  protected setNodeColor(nodeId: string, data: NodeData, color: string): void {
    this.updateSelectedNodeData(nodeId, { ...data, color });
  }

  protected setNodeBorderColor(nodeId: string, data: NodeData, borderColor: string): void {
    this.updateSelectedNodeData(nodeId, { ...data, borderColor });
  }

  protected setNodeHeaderColor(nodeId: string, data: NodeData, headerColor: string): void {
    this.updateSelectedNodeData(nodeId, { ...data, headerColor });
  }

  protected setBoxPortsLayout(nodeId: string, data: BoxPortsNodeData, event: Event): void {
    const layout = (event.target as HTMLSelectElement).value as 'vertical' | 'horizontal';
    this.updateSelectedNodeData(nodeId, { ...data, layout: layout === 'vertical' ? undefined : layout });
  }

  protected setNodeImageAttachment(nodeId: string, data: NodeData, attachmentId: string | null): void {
    if (data.shape !== 'image') return;
    this.updateSelectedNodeData(nodeId, { ...data, imageAttachmentId: attachmentId ?? undefined });
  }

  protected setNodeTransparent(nodeId: string, data: NodeData, event: Event): void {
    const transparent = (event.target as HTMLInputElement).checked;
    this.updateSelectedNodeData(nodeId, { ...data, transparent });
  }

  protected onNodeIconPicked(icon: string | undefined): void {
    const target = this.pickerTarget();
    if (target?.kind !== 'node-icon') return;
    const existing = this.modelService.getNodeById<NodeData>(target.nodeId)?.data;
    if (existing) this.updateSelectedNodeData(target.nodeId, { ...existing, icon });
    this.pickerTarget.set(null);
  }

  protected setEdgeLabel(edgeId: string, event: Event): void {
    const label = (event.target as HTMLInputElement).value;
    const sel = this.selection();
    if (sel?.kind !== 'edge') return;
    this.modelService.updateEdgeData(edgeId, { ...sel.data, label });
  }

  /** `kind` is the abstract 'arrow' | 'dot' choice from arrowheadOptions —
   *  stored as the width-tiered marker id (see arrowhead-marker.ts), since
   *  ng-diagram resolves an edge's marker from its own sourceArrowhead/
   *  targetArrowhead field directly rather than any template-level input. */
  protected setEdgeArrowhead(edgeId: string, end: 'source' | 'target', kind: string | undefined): void {
    const sel = this.selection();
    if (sel?.kind !== 'edge') return;
    const key = end === 'source' ? 'sourceArrowhead' : 'targetArrowhead';
    const arrowhead = kind ? arrowheadTieredId(kind, sel.data.width) : undefined;
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
      ...(type
        ? {
            color: wireOrCableColor(type, this.connectionTypes) ?? sel.data.color,
            dash: wireOrCableDash(type, this.connectionTypes) ?? sel.data.dash,
          }
        : {}),
    };
    this.modelService.updateEdgeData(edgeId, data);
    this.selection.set({ ...sel, data });
    this.cascadeTypeFromEdge(edgeId, oldType, type);
  }

  protected setEdgeDash(edgeId: string, dash: DashStyle): void {
    const sel = this.selection();
    if (sel?.kind !== 'edge') return;
    const data = { ...sel.data, dash };
    this.modelService.updateEdgeData(edgeId, data);
    this.selection.set({ ...sel, data });
  }

  protected setEdgeWidth(edgeId: string, width: number): void {
    const sel = this.selection();
    if (sel?.kind !== 'edge') return;
    const data = { ...sel.data, width };
    this.modelService.updateEdgeData(edgeId, data);
    // The arrowhead's size tier is baked into its stored marker id (see
    // arrowhead-marker.ts) — re-derive it for the new width so an existing
    // arrowhead keeps tracking the line instead of staying pinned to
    // whatever size it was picked at.
    const sourceArrowhead = sel.sourceArrowhead ? arrowheadTieredId(sel.sourceArrowhead, width) : sel.sourceArrowhead;
    const targetArrowhead = sel.targetArrowhead ? arrowheadTieredId(sel.targetArrowhead, width) : sel.targetArrowhead;
    if (sourceArrowhead !== sel.sourceArrowhead || targetArrowhead !== sel.targetArrowhead) {
      this.modelService.updateEdge(edgeId, { sourceArrowhead, targetArrowhead });
    }
    this.selection.set({ ...sel, data, sourceArrowhead, targetArrowhead });
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

  protected bringSelectionToFront(): void {
    const sel = this.selection();
    if (!sel) return;
    if (sel.kind === 'node') this.nodeService.bringToFront([sel.id]);
    else this.nodeService.bringToFront([], [sel.id]);
  }

  protected sendSelectionToBack(): void {
    const sel = this.selection();
    if (!sel) return;
    if (sel.kind === 'node') this.nodeService.sendToBack([sel.id]);
    else this.nodeService.sendToBack([], [sel.id]);
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
