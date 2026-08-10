import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DiagramDto } from '@smart-home-inventory/shared';
import { mdiArrowLeft, mdiChartTimelineVariant } from '@mdi/js';
import { DiagramsApi } from '../../core/api/api.services';
import { IconComponent } from '../../shared/ui/icon.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { DiagramCanvasComponent } from './diagram-canvas.component';

@Component({
  selector: 'app-diagrams-page',
  imports: [IconComponent, EmptyStateComponent, DiagramCanvasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (selected(); as s) {
      <app-diagram-canvas
        #canvas
        [diagramId]="s.id"
        [areaId]="areaId()"
        [deviceId]="deviceId()"
        (saved)="onSaved($event)"
        (deleted)="onDeleted()"
        (back)="back()"
      />
    } @else {
      <app-empty-state [icon]="icons.diagram" message="No diagram selected">
        <button type="button" class="btn secondary" (click)="back()">
          <app-icon [path]="icons.back" [size]="18" /> Back
        </button>
      </app-empty-state>
    }
  `,
  styles: `
    /* The diagram canvas needs real screen space — opt this page out of the
       app-wide 1100px content cap and main's own padding (see
       main:has(app-diagrams-page) in app.ts) so it runs edge-to-edge under
       just the top nav bar. */
    :host {
      display: block;
      max-width: none;
      width: 100%;
    }
  `,
})
export class DiagramsPageComponent implements OnInit {
  private readonly api = inject(DiagramsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly canvas = viewChild<DiagramCanvasComponent>('canvas');

  protected readonly selected = signal<DiagramDto | null>(null);
  protected readonly areaId = signal<string | null>(null);
  protected readonly deviceId = signal<string | null>(null);
  protected readonly standalone = signal(false);

  protected readonly icons = {
    back: mdiArrowLeft,
    diagram: mdiChartTimelineVariant,
  };

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.areaId.set(params.get('areaId'));
      this.deviceId.set(params.get('deviceId'));
      this.standalone.set(params.get('standalone') === '1');
      const openId = params.get('open');
      this.load(openId ?? undefined);
    });
  }

  private load(openId?: string): void {
    const areaId = this.areaId();
    const deviceId = this.deviceId();
    const q = areaId ? { areaId } : deviceId ? { deviceId } : { standalone: '1' as const };
    this.api.list(q).subscribe((diagrams) => {
      const toSelect = openId
        ? diagrams.find((d) => d.id === openId)
        : this.selected()
          ? diagrams.find((d) => d.id === this.selected()?.id)
          : undefined;
      this.selected.set(toSelect ?? null);
    });
  }

  protected back(): void {
    const areaId = this.areaId();
    const deviceId = this.deviceId();
    if (areaId) this.router.navigate(['/areas', areaId]);
    else if (deviceId) this.router.navigate(['/devices', deviceId]);
    else this.router.navigate(['/home']);
  }

  protected onSaved(updated: DiagramDto): void {
    if (this.selected()?.id === updated.id) this.selected.set(updated);
  }

  protected onDeleted(): void {
    this.selected.set(null);
  }

  /** Used by diagramsDeactivateGuard to block navigation away from unsaved edits. */
  hasUnsavedChanges(): boolean {
    return this.canvas()?.hasUnsavedChanges() ?? false;
  }
}
