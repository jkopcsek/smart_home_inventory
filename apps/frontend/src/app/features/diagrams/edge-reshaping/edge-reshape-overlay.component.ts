import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { NgDiagramSelectionService, NgDiagramViewportService } from 'ng-diagram';
import {
  findReshapeableSegments,
  normalizeRoute,
  type ReshapeEndpointKind,
  type ReshapeSegment,
} from './logic';
import {
  EdgeReshapeHandler,
  type ReshapeDragState,
  type ReshapeStartDescriptor,
} from './handlers/edge-reshape.handler';

/**
 * Renders a drag handle on every orthogonal segment of a selected edge and
 * forwards the pointer gesture to the handler — UI only, no geometry, no
 * model writes (those live in logic/ and commands/).
 */
@Component({
  selector: 'app-edge-reshape-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="reshape-overlay__layer" [style.transform]="transform()">
      @for (h of handles(); track h.edgeId + ':' + h.segmentIndex) {
        <span
          class="reshape-overlay__handle"
          [class.is-horizontal]="h.axis === 'horizontal'"
          [class.is-vertical]="h.axis === 'vertical'"
          [style.left.px]="h.midpoint.x"
          [style.top.px]="h.midpoint.y"
          (pointerdown)="onPointerDown($event, h)"
          aria-hidden="true"
        >
          <!-- Drag-direction arrow: vertical (↕) by default for horizontal segments;
               rotated to ↔ for vertical segments. Shown on hover / while dragging. -->
          <svg class="reshape-overlay__arrow" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 4V20M12 4L8.5 7.5M12 4L15.5 7.5M12 20L8.5 16.5M12 20L15.5 16.5"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
      }
    </div>
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }
    .reshape-overlay__layer {
      position: absolute;
      inset: 0;
      transform-origin: 0 0;
      will-change: transform;
    }
    /* Segment reshape handle. Idle: two accent grip bars parallel to the segment,
       hugging the wire. Hover/drag: a double-arrow showing the drag axis (↕ for a
       horizontal segment, ↔ for a vertical one). */
    .reshape-overlay__handle {
      position: absolute;
      width: 22px;
      height: 22px;
      background: transparent;
      color: var(--primary-text-color);
      pointer-events: auto;
      transform: translate(-50%, -50%);
      touch-action: none;
    }
    .reshape-overlay__handle.is-horizontal {
      cursor: ns-resize;
    }
    .reshape-overlay__handle.is-vertical {
      cursor: ew-resize;
    }
    .reshape-overlay__handle::before,
    .reshape-overlay__handle::after {
      content: '';
      position: absolute;
      background: var(--primary-color);
      border-radius: 9999px;
      transition: opacity 0.1s ease;
    }
    /* Each bar is centred on the midpoint (translate -50%/-50%), then nudged
       ±5px perpendicular — so the wire passes exactly between the pair. */
    .reshape-overlay__handle.is-horizontal::before,
    .reshape-overlay__handle.is-horizontal::after {
      top: 50%;
      left: 50%;
      width: 14px;
      height: 2px;
    }
    .reshape-overlay__handle.is-horizontal::before {
      transform: translate(-50%, -50%) translateY(-5px);
    }
    .reshape-overlay__handle.is-horizontal::after {
      transform: translate(-50%, -50%) translateY(5px);
    }
    .reshape-overlay__handle.is-vertical::before,
    .reshape-overlay__handle.is-vertical::after {
      top: 50%;
      left: 50%;
      width: 2px;
      height: 14px;
    }
    .reshape-overlay__handle.is-vertical::before {
      transform: translate(-50%, -50%) translateX(-5px);
    }
    .reshape-overlay__handle.is-vertical::after {
      transform: translate(-50%, -50%) translateX(5px);
    }
    .reshape-overlay__arrow {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      transition: opacity 0.1s ease;
      pointer-events: none;
      filter: drop-shadow(0 0 1.5px var(--card-background-color));
    }
    /* Vertical segment drags horizontally → rotate the ↕ glyph to ↔. */
    .reshape-overlay__handle.is-vertical .reshape-overlay__arrow {
      transform: rotate(90deg);
    }
    .reshape-overlay__handle:hover::before,
    .reshape-overlay__handle:hover::after,
    .reshape-overlay__handle.is-dragging::before,
    .reshape-overlay__handle.is-dragging::after {
      opacity: 0;
    }
    .reshape-overlay__handle:hover .reshape-overlay__arrow,
    .reshape-overlay__handle.is-dragging .reshape-overlay__arrow {
      opacity: 1;
    }
  `,
})
export class EdgeReshapeOverlayComponent {
  private readonly selectionService = inject(NgDiagramSelectionService);
  private readonly viewportService = inject(NgDiagramViewportService);
  private readonly handler = inject(EdgeReshapeHandler);

  constructor() {
    // Release capture + clear the mask if destroyed mid-drag.
    inject(DestroyRef).onDestroy(() => {
      this.handler.teardown();
    });
  }

  protected readonly handles = computed<readonly ReshapeStartDescriptor[]>(() => {
    const drag = this.handler.current;
    const gestureOn = this.handler.gestureActive();
    const selection = this.selectionService.selection();
    const handles: ReshapeStartDescriptor[] = [];
    for (const edge of selection.edges) {
      const sourceKind = this.classifyEndpoint(edge.source);
      const targetKind = this.classifyEndpoint(edge.target);
      const isDragged = !!drag && gestureOn && drag.edgeId === edge.id;
      if (isDragged && drag) {
        const segments = findReshapeableSegments(edge.points, sourceKind, targetKind);
        for (const segment of this.maskInjectedBends(segments, drag, edge.points?.length ?? 0)) {
          handles.push({ edgeId: edge.id, ...segment });
        }
      } else {
        const segments = findReshapeableSegments(
          normalizeRoute(edge.points),
          sourceKind,
          targetKind
        );
        for (const segment of segments) {
          handles.push({ edgeId: edge.id, ...segment });
        }
      }
    }
    return handles;
  });

  protected readonly transform = computed(() => {
    const viewport = this.viewportService.viewport();
    return `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`;
  });

  protected onPointerDown(event: PointerEvent, handle: ReshapeStartDescriptor): void {
    // Stop ng-diagram from treating this as selection / box-select.
    event.stopPropagation();
    event.preventDefault();
    this.handler.start(event, event.currentTarget as HTMLElement, handle);
  }

  // An edge end is anchored when connected to a port, dangling when loose.
  private classifyEndpoint(nodeId: string): ReshapeEndpointKind {
    return nodeId ? 'anchored' : 'dangling';
  }

  // Drop L-bends injected this gesture and shift the remaining indices so
  // the dragged handle keeps its original track key.
  private maskInjectedBends(
    segments: readonly ReshapeSegment[],
    drag: ReshapeDragState,
    liveLen: number
  ): ReshapeSegment[] {
    const initialLen = drag.initialPoints.length;
    const lengthDiff = liveLen - initialLen;
    if (lengthDiff <= 0) return segments.slice();

    const sourceBendInserted =
      drag.anchorPortAtSource && drag.segmentIndex === 0 && lengthDiff >= 1;
    const targetBendInserted =
      drag.anchorPortAtTarget &&
      drag.segmentIndex === initialLen - 2 &&
      lengthDiff >= (sourceBendInserted ? 2 : 1);

    const targetBendLiveIndex = liveLen - 2;
    const result: ReshapeSegment[] = [];
    for (const segment of segments) {
      if (sourceBendInserted && segment.segmentIndex === 0) continue;
      if (targetBendInserted && segment.segmentIndex === targetBendLiveIndex) continue;
      const remapped = sourceBendInserted
        ? { ...segment, segmentIndex: segment.segmentIndex - 1 }
        : segment;
      result.push(remapped);
    }
    return result;
  }
}
