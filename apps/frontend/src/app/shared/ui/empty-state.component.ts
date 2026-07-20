import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-empty-state',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty">
      <app-icon [path]="icon()" [size]="42" />
      <p>{{ message() }}</p>
      <ng-content />
    </div>
  `,
  styles: `
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: var(--secondary-text-color);
      padding: 32px 16px;
      text-align: center;
    }
    p {
      margin: 0;
    }
  `,
})
export class EmptyStateComponent {
  readonly icon = input.required<string>();
  readonly message = input.required<string>();
}
