import { Injectable, signal } from '@angular/core';

/** Exposes DiagramCanvasComponent's read-only state to node templates.
 *  ng-diagram instantiates node templates itself (NgDiagramNodeTemplate<T>'s
 *  contract is just `node: InputSignal<Node<T>>`), so there's no template
 *  binding to thread readOnly through — provided by DiagramCanvasComponent
 *  and injected wherever a node template needs to tone down hover/port
 *  affordances that don't do anything while merely viewing. */
@Injectable()
export class DiagramViewState {
  readonly readOnly = signal(true);
}
