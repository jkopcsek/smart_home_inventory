import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Node as NgNode, NgDiagramNodeTemplate, NgDiagramPortComponent } from 'ng-diagram';
import { AnchorNodeData } from '@smart-home-inventory/shared';

/** Id of the anchor's one and only port — connecting edges must reference
 *  it explicitly (sourcePort/targetPort) rather than leaving it unset. See
 *  the port's own CSS for why: an edge with no port id falls back to
 *  ng-diagram's default "nearest side of the node's bounding box" — for a
 *  small square node that visibly snaps between up to 4 different points
 *  as the anchor moves, instead of tracking its center. */
export const ANCHOR_PORT_ID = 'center';

/**
 * A minimal draggable point — one end of an annotation line/polyline (see
 * the diagram canvas's line-drawing tool). No label, color, icon, or link.
 */
@Component({
  selector: 'app-anchor-node',
  imports: [NgDiagramPortComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hit-area">
      <div class="dot" [class.selected]="node().selected"></div>
      <!-- type="target" (not "both") plus pointer-events: none below — the
           port only needs to be an attachment point for the polyline edges
           we create ourselves, never something a user drags a new wire out
           of by hand. It sits exactly on top of the visible dot (see CSS),
           so without both of these a normal drag-to-move on the dot swallows
           the pointerdown as "start linking" instead — type alone still
           intercepts and eats the event even when it refuses to act on it,
           so dragging just silently did nothing instead of moving the node. -->
      <ng-diagram-port [id]="portId" type="target" side="top" />
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .hit-area {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--primary-color);
      border: 1.5px solid var(--card-background-color);
      pointer-events: none;
    }
    /* Accent (not primary) color — primary is also the dot's own fill, so a
       same-colored ring would blend in. Same convention as the other
       hand-built (non-base-node-template) node shapes. */
    .dot.selected {
      box-shadow: 0 0 0 3px var(--accent-color);
    }
    /* Positions this port so ng-diagram computes ITS edge-attachment point
       as exactly the node's center — not just visually, but in the actual
       routing math, which is lopsided: for side="top" it's node.x + portX
       + portWidth/2 (self-corrected) but node.y + portY, uncorrected (see
       getPortPosition in the library). So portX must be the node's
       *horizontal center minus half the port's own width* (translateX
       cancels the correction back to center) while portY must be the
       node's *vertical center exactly, unadjusted* (no translateY, or the
       correction-free Y axis would land half a port-height off). Verified
       against the library's own measured port position, not just visually —
       an off-by-half-the-port-size discrepancy here is invisible at this
       port's ~4px size but was exactly what caused the original bug (see
       ANCHOR_PORT_ID doc above) at the old default port size. */
    ng-diagram-port {
      position: absolute !important;
      top: 50% !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      --ngd-port-background-color: transparent;
      --ngd-port-border-size: 0;
      --ngd-port-background-color-hover: transparent;
      --ngd-port-border-size-hover: 0;
      /* Not interactive — see the template comment above. Position is a DOM
         measurement the routing math reads, not something that needs live
         pointer events, so this is safe: dragging now falls through to
         normal node-move handling instead of being swallowed by the port. */
      pointer-events: none !important;
    }
  `,
})
export class AnchorNodeComponent implements NgDiagramNodeTemplate<AnchorNodeData> {
  readonly node = input.required<NgNode<AnchorNodeData>>();
  protected readonly portId = ANCHOR_PORT_ID;
}
