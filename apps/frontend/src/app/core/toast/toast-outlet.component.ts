import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [class]="'toast ' + toast.kind">{{ toast.message }}</div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 1000;
    }
    .toast {
      background: #333;
      color: #fff;
      border-radius: 6px;
      padding: 10px 20px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      max-width: 80vw;
    }
    .toast.error {
      background: var(--error-color);
    }
    .toast.success {
      background: var(--success-color);
    }
  `,
})
export class ToastOutletComponent {
  protected readonly toastService = inject(ToastService);
}
