import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Node as NgNode, NgDiagramNodeTemplate, NgDiagramPortComponent } from 'ng-diagram';
import { BoxPortsNodeData, NodePort, WIRE_TYPE_COLORS } from '@smart-home-inventory/shared';

/**
 * The "Box with ports" shape: a user-configurable number of named
 * input/output ports — modeled on ng-diagram's AV-schematic demo's
 * device-node component (inputs left, outputs right; a row per port with a
 * small rectangular pin nudged past the card's edge).
 */
@Component({
  selector: 'app-box-ports-node',
  imports: [NgDiagramPortComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="box-ports" [style.borderColor]="data().color || '#03a9f4'">
      <div class="header" [style.background]="data().color || '#03a9f4'">
        {{ data().label || 'Switch box' }}
      </div>
      <div class="columns">
        <div class="column">
          @for (port of inputPorts(); track port.id; let last = $last) {
            <div class="port-row" [class.port-row--last]="last">
              <ng-diagram-port [id]="port.id" side="left" type="both" class="port">
                <div
                  class="port-shape port-shape--input"
                  [style.background]="portColor(port)"
                  [style.border-color]="portColor(port)"
                ></div>
              </ng-diagram-port>
              <span class="label">{{ portDisplayLabel(port) }}</span>
            </div>
          }
        </div>
        <div class="column align-right">
          @for (port of outputPorts(); track port.id; let last = $last) {
            <div class="port-row" [class.port-row--last]="last">
              <span class="label">{{ portDisplayLabel(port) }}</span>
              <ng-diagram-port [id]="port.id" side="right" type="both" class="port">
                <div
                  class="port-shape port-shape--output"
                  [style.background]="portColor(port)"
                  [style.border-color]="portColor(port)"
                ></div>
              </ng-diagram-port>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .box-ports {
      background: var(--card-background-color);
      border: 2px solid;
      border-radius: 8px;
      min-width: 170px;
      overflow: visible;
    }
    .header {
      color: #fff;
      font-size: 13px;
      font-weight: 500;
      padding: 10px 14px;
      border-radius: 6px 6px 0 0;
      text-align: center;
      letter-spacing: 0.02em;
    }
    .columns {
      display: flex;
    }
    .column {
      display: flex;
      flex-direction: column;
      flex: 1 1 50%;
      min-width: 0;
      padding: 8px 0;
    }
    .column:first-child {
      border-right: 1px solid var(--divider-color);
    }
    .align-right {
      align-items: flex-end;
    }
    .port-row {
      position: relative;
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      box-sizing: border-box;
      min-height: 32px;
      padding: 6px 12px;
      border-bottom: 1px solid var(--divider-color);
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
      width: 9px;
      height: 14px;
      background: var(--card-background-color);
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
    .label {
      font-size: 11px;
      color: var(--primary-text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class BoxPortsNodeComponent implements NgDiagramNodeTemplate<BoxPortsNodeData> {
  readonly node = input.required<NgNode<BoxPortsNodeData>>();

  protected readonly data = computed(() => this.node().data);
  protected readonly inputPorts = computed(() => this.portsByDirection('in'));
  protected readonly outputPorts = computed(() => this.portsByDirection('out'));

  private portsByDirection(direction: NodePort['direction']): NodePort[] {
    return this.data().ports.filter((p) => p.direction === direction);
  }

  protected portColor(port: NodePort): string | null {
    return port.wireType ? WIRE_TYPE_COLORS[port.wireType] : null;
  }

  protected portDisplayLabel(port: NodePort): string {
    if (port.label && port.wireType) return `${port.label} (${port.wireType})`;
    return port.label || port.wireType || '';
  }
}
