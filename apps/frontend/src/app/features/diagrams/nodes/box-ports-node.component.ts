import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Node as NgNode, NgDiagramNodeTemplate, NgDiagramPortComponent } from 'ng-diagram';
import { mdiLinkVariant } from '@mdi/js';
import { BoxPortsNodeData, NodePort, wireOrCableColor, wireOrCableLabel } from '@smart-home-inventory/shared';
import { ConnectionTypesStore } from '../../../core/connection-types/connection-types.store';
import { IconComponent } from '../../../shared/ui/icon.component';
import { DEFAULT_BODY_COLOR, DEFAULT_BORDER_COLOR, DEFAULT_PORTS_BG_COLOR, DEFAULT_SEPARATOR_COLOR } from './node-defaults';
import { nodeIconPath } from './node-icons';

/**
 * The "Box with ports" shape: a user-configurable number of named
 * input/output ports — modeled on ng-diagram's AV-schematic demo's
 * device-node component (inputs left, outputs right; a row per port with a
 * small rectangular pin nudged past the card's edge). Deliberately not
 * resizable — its size is a function of how many ports it has, not something
 * to set independently (add/remove a port and the box should just fit).
 *
 * `data.layout` picks between that (vertical, the default) and horizontal —
 * inputs along the top edge, outputs along the bottom, each row reading
 * left-to-right — for when a long list of ports (e.g. a row of breakers)
 * reads better as a wide, short box than a tall, narrow one. Port labels
 * stay upright either way; only which axis the ports are laid out along
 * changes. See the `.horizontal` styles below for the mechanics.
 */
@Component({
  selector: 'app-box-ports-node',
  imports: [NgDiagramPortComponent, IconComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="box-ports"
      [class.selected]="node().selected"
      [class.horizontal]="horizontal()"
      [style.borderColor]="data().color || defaultBorderColor"
    >
      @if (!horizontal()) {
        <ng-container [ngTemplateOutlet]="header" />
      }
      <div class="columns">
        <div class="column">
          @for (port of inputPorts(); track port.id; let last = $last) {
            <div class="port-row" [class.port-row--last]="last">
              <ng-diagram-port [id]="port.id" [side]="horizontal() ? 'top' : 'left'" type="both" class="port">
                <div
                  class="port-shape port-shape--input"
                  [style.background]="portColor(port)"
                  [style.border-color]="portBorderColor(port)"
                ></div>
              </ng-diagram-port>
              <div class="port-labels">
                @if (port.label) {
                  <span class="label">{{ port.label }}</span>
                }
                @if (wireOrCableLabel(port.type, connectionTypes); as type) {
                  <span class="type">{{ type }}</span>
                }
              </div>
            </div>
          }
        </div>
        @if (horizontal()) {
          <ng-container [ngTemplateOutlet]="header" />
        }
        <div class="column align-right">
          @for (port of outputPorts(); track port.id; let last = $last) {
            <div class="port-row" [class.port-row--last]="last">
              <div class="port-labels">
                @if (port.label) {
                  <span class="label">{{ port.label }}</span>
                }
                @if (wireOrCableLabel(port.type, connectionTypes); as type) {
                  <span class="type">{{ type }}</span>
                }
              </div>
              <ng-diagram-port [id]="port.id" [side]="horizontal() ? 'bottom' : 'right'" type="both" class="port">
                <div
                  class="port-shape port-shape--output"
                  [style.background]="portColor(port)"
                  [style.border-color]="portBorderColor(port)"
                ></div>
              </ng-diagram-port>
            </div>
          }
        </div>
      </div>
    </div>

    <ng-template #header>
      <div class="header" [style.background]="data().headerColor || defaultHeaderColor">
        @if (iconPath(); as p) {
          <app-icon class="header-icon" [path]="p" [size]="16" />
        }
        {{ data().label || 'Switch box' }}
        @if (data().link) {
          <app-icon class="link-badge" [path]="linkIcon" [size]="12" title="Linked to a real item" />
        }
      </div>
    </ng-template>
  `,
  styles: `
    .box-ports {
      background: ${DEFAULT_PORTS_BG_COLOR};
      border: 2px solid;
      border-radius: 8px;
      min-width: 210px;
      overflow: visible;
    }
    /* The library's default selection ring only applies via
       ng-diagram-base-node-template, which this custom shape doesn't use —
       draw our own around the whole box. Accent (not primary) color —
       primary is also the default border/header color, so a same-colored
       ring would blend in on an unstyled box. */
    .box-ports.selected {
      box-shadow: 0 0 0 3px var(--accent-color);
    }
    .header {
      position: relative;
      color: #fff;
      font-size: 14px;
      font-weight: 500;
      padding: 16px;
      border-radius: 6px 6px 0 0;
      text-align: center;
      letter-spacing: 0.02em;
    }
    .header-icon {
      vertical-align: -3px;
      margin-right: 4px;
    }
    .link-badge {
      position: absolute;
      top: 50%;
      right: 10px;
      transform: translateY(-50%);
    }
    .columns {
      display: flex;
    }
    .column {
      display: flex;
      flex-direction: column;
      flex: 1 1 50%;
      min-width: 0;
      /* No padding here — every port-row is a fixed height (see below), so
       * the first/last row's own centered content already sits exactly as
       * far from the header/bottom edge as any two rows sit from each
       * other. Column padding would only add extra space at the two ends
       * that the middle rows don't get, making the first/last port look
       * bigger than the rest. */
    }
    .column:first-child {
      border-right: 1px solid ${DEFAULT_SEPARATOR_COLOR};
    }
    .align-right {
      align-items: flex-end;
    }
    .port-row {
      position: relative;
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      box-sizing: border-box;
      /* Fixed, not min-height — every port-row is exactly this tall
       * regardless of whether it has a label, a type, both, or neither, so
       * a two-line port doesn't grow past its one-line neighbors and the
       * whole column keeps an even rhythm. Sized to comfortably fit two
       * lines (label + type); align-items:center then centers whatever's
       * actually there (one line, two, or none) within that fixed height. */
      height: 44px;
      padding: 0 14px;
      border-bottom: 1px solid ${DEFAULT_SEPARATOR_COLOR};
    }
    .port-row--last {
      border-bottom: none;
    }
    .align-right .port-row {
      flex-direction: row-reverse;
    }
    .port {
      /* null out the port's own default marker — .port-shape is the visible pin */
      --ngd-port-size: 0;
      --ngd-port-background-color: transparent;
      --ngd-port-border-size: 0;
      /* ng-diagram-port ships its own :host.left/.right + origin-* positioning
       * CSS (auto-centers on the whole node's edge) that can win the cascade
       * over these same-specificity rules — !important forces our per-row
       * centering to always apply instead. */
      position: absolute !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
    }
    .column:not(.align-right) .port {
      left: -9px !important;
      right: auto !important;
    }
    .align-right .port {
      left: auto !important;
      right: -9px !important;
    }
    .port-shape {
      width: 10px;
      height: 16px;
      background: ${DEFAULT_PORTS_BG_COLOR};
      border: 1px solid var(--secondary-text-color);
      transition:
        background-color 120ms ease,
        border-color 120ms ease;
    }
    .port-shape--input {
      border-radius: 4px 0 0 4px;
      border-right: none;
    }
    .port-shape--output {
      border-radius: 0 4px 4px 0;
      border-left: none;
    }
    .port-row:hover .port-shape {
      background: var(--secondary-text-color);
    }
    .port-labels {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      min-width: 0;
      line-height: 1.3;
    }
    .align-right .port-labels {
      align-items: flex-end;
    }
    .label {
      font-size: 12px;
      color: var(--primary-text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    .type {
      font-size: 10px;
      /* a bit darker than .label, regardless of light/dark theme */
      color: color-mix(in srgb, var(--primary-text-color) 75%, black);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    /* Horizontal layout: the two port groups become stacked rows (in along
     * the top edge, out along the bottom) instead of side-by-side columns,
     * each port a narrow column instead of a wide row — everything below
     * transposes the vertical-mode rules above onto the other axis. Text
     * stays upright throughout (see BoxPortsNodeComponent's doc comment on
     * the layout field for why) rather than rotating with the ports.
     *
     * The header itself moves from the top edge to a band between the two
     * rows (see the #header ng-template's two placements above) — the top
     * and bottom edges are where the pins live now, so a full-width header
     * up top would sit right on top of the input row's pins. */
    .box-ports.horizontal .header {
      text-align: left;
      border-radius: 0;
      border-bottom: 1px solid ${DEFAULT_SEPARATOR_COLOR};
    }
    .box-ports.horizontal .columns {
      flex-direction: column;
    }
    .box-ports.horizontal .column {
      flex-direction: row;
      align-items: center;
      flex: 0 0 auto;
      padding: 0 6px;
    }
    .box-ports.horizontal .column:first-child {
      border-right: none;
      border-bottom: 1px solid ${DEFAULT_SEPARATOR_COLOR};
    }
    .box-ports.horizontal .port-row {
      flex-direction: column;
      /* .port-row's own align-items:center now centers along this column's
       * cross axis (horizontal) — justify-content is what centers along
       * its main axis (vertical), which is the one that matters here. */
      justify-content: center;
      width: auto;
      min-width: 64px;
      /* Fixed, not min-height — same reasoning as the vertical layout's
       * .port-row above: every port-column is exactly this tall regardless
       * of its own content, tall enough for two lines, so a two-line port
       * (label + type) doesn't push its own pin out of line with its
       * one-line neighbors'. */
      height: 52px;
      padding: 0 8px;
      border-bottom: none;
      border-right: 1px solid ${DEFAULT_SEPARATOR_COLOR};
    }
    .box-ports.horizontal .port-row--last {
      border-right: none;
    }
    .box-ports.horizontal .port {
      top: auto !important;
      left: 50% !important;
      right: auto !important;
      transform: translateX(-50%) !important;
    }
    .box-ports.horizontal .column:not(.align-right) .port {
      top: -9px !important;
      bottom: auto !important;
    }
    .box-ports.horizontal .align-right .port {
      bottom: -9px !important;
      top: auto !important;
    }
    .box-ports.horizontal .port-shape {
      width: 16px;
      height: 10px;
    }
    .box-ports.horizontal .port-shape--input {
      border-left: 1px solid var(--secondary-text-color);
      border-right: 1px solid var(--secondary-text-color);
      border-top: 1px solid var(--secondary-text-color);
      border-bottom: none;
      border-radius: 4px 4px 0 0;
    }
    .box-ports.horizontal .port-shape--output {
      border-left: 1px solid var(--secondary-text-color);
      border-right: 1px solid var(--secondary-text-color);
      border-bottom: 1px solid var(--secondary-text-color);
      border-top: none;
      border-radius: 0 0 4px 4px;
    }
    .box-ports.horizontal .port-labels,
    .box-ports.horizontal .align-right .port-labels {
      align-items: center;
      text-align: center;
    }
    .box-ports.horizontal .label,
    .box-ports.horizontal .type {
      white-space: normal;
      text-align: center;
    }
  `,
})
export class BoxPortsNodeComponent implements NgDiagramNodeTemplate<BoxPortsNodeData> {
  readonly node = input.required<NgNode<BoxPortsNodeData>>();
  protected readonly connectionTypes = inject(ConnectionTypesStore);
  protected readonly linkIcon = mdiLinkVariant;
  protected readonly defaultBorderColor = DEFAULT_BORDER_COLOR;
  protected readonly defaultHeaderColor = DEFAULT_BODY_COLOR;

  protected readonly data = computed(() => this.node().data);
  protected readonly iconPath = computed(() => nodeIconPath(this.data().icon));
  protected readonly horizontal = computed(() => this.data().layout === 'horizontal');
  protected readonly inputPorts = computed(() => this.portsByDirection('in'));
  protected readonly outputPorts = computed(() => this.portsByDirection('out'));
  protected readonly wireOrCableLabel = wireOrCableLabel;

  private portsByDirection(direction: NodePort['direction']): NodePort[] {
    return this.data().ports.filter((p) => p.direction === direction);
  }

  protected portColor(port: NodePort): string | null {
    return wireOrCableColor(port.type, this.connectionTypes);
  }

  /** A typed port's pin still takes its wire/cable color; an untyped one
   *  borders in the box's own border color instead of a generic neutral —
   *  ties the pin back to the box it belongs to rather than looking like
   *  a completely unstyled placeholder. */
  protected portBorderColor(port: NodePort): string {
    return this.portColor(port) ?? this.data().color ?? this.defaultBorderColor;
  }
}
