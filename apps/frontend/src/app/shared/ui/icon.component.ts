import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Renders an @mdi/js path — the exact icon set Home Assistant uses. */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 24 24" [style.width.px]="size()" [style.height.px]="size()">
      <path [attr.d]="path()" fill="currentColor" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      vertical-align: middle;
    }
  `,
})
export class IconComponent {
  readonly path = input.required<string>();
  readonly size = input(20);
}
