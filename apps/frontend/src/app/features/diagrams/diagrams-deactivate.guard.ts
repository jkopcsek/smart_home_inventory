import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmService } from '../../core/confirm/confirm.service';
import type { DiagramsPageComponent } from './diagrams-page.component';

/** Blocks in-app navigation away from a diagram with unsaved edits — the
 *  beforeunload handler on DiagramCanvasComponent covers tab close/refresh
 *  instead, since router guards don't run for those. */
export const diagramsDeactivateGuard: CanDeactivateFn<DiagramsPageComponent> = (
  component
) => {
  if (!component.hasUnsavedChanges()) return true;
  return inject(ConfirmService).ask(
    'You have unsaved changes in this diagram. Leaving now will discard them.',
    { title: 'Discard changes?', confirmLabel: 'Discard', cancelLabel: 'Stay' }
  );
};
