import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Node as NgNode, NgDiagramNodeTemplate, NgDiagramPortComponent } from 'ng-diagram';
import { BoxPortsNodeData, NodePort } from '@smart-home-inventory/shared';

/**
 * The "Box with ports" shape: a user-configurable number of named
 * input/output ports — modeled on ng-diagram's AV-schematic demo's
 * device-node component (inputs left, outputs right).
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
          @for (port of inputPorts(); track port.id) {
            <div class="port-row">
              <ng-diagram-port [id]="port.id" side="left" type="both" />
              <span class="dot"></span>
              <span class="label">{{ port.label }}</span>
            </div>
          }
        </div>
        <div class="column align-right">
          @for (port of outputPorts(); track port.id) {
            <div class="port-row">
              <span class="label">{{ port.label }}</span>
              <span class="dot"></span>
              <ng-diagram-port [id]="port.id" side="right" type="both" />
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
      min-width: 160px;
      overflow: visible;
    }
    .header {
      color: #fff;
      font-size: 12px;
      font-weight: 500;
      padding: 6px 10px;
      border-radius: 6px 6px 0 0;
      text-align: center;
    }
    .columns {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 8px 6px;
    }
    .column {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 60px;
    }
    .align-right {
      align-items: flex-end;
    }
    .port-row {
      position: relative;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .align-right .port-row {
      flex-direction: row-reverse;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--secondary-text-color);
      flex-shrink: 0;
    }
    .label {
      font-size: 11px;
      color: var(--primary-text-color);
      white-space: nowrap;
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
}
