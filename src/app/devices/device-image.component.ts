import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { DeviceKind } from './vendor';

/**
 * Das Bild in der Hersteller-Spalte.
 *
 * Liegt für die Modellkennung ein Produktfoto im Repository, wird es gezeigt. Sonst ein
 * selbst gezeichnetes Symbol zur Geräteart — kein nachgebautes Herstellerlogo, siehe
 * `vendor.ts` und docs/plans/projekt-geraete.md.
 *
 * Die Symbole stehen inline im Template statt als Dateien in `assets/`: Sie erben so
 * `currentColor` und passen sich damit hell/dunkel an (REQUIREMENTS §4.5), und eine
 * Notfall-App muss beim Zeichnen ihrer Liste auf keine Datei warten.
 */
@Component({
  selector: 'app-device-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (photo(); as src) {
      <img class="photo" [src]="src" [alt]="alt()" />
    } @else {
      <svg
        class="symbol"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        @switch (kind()) {
          @case ('switch') {
            <rect x="4" y="3" width="16" height="18" rx="2.5" />
            <rect x="7.5" y="6" width="9" height="6" rx="1.5" />
            <path d="M8 16.5h8" />
          }
          @case ('plug') {
            <circle cx="12" cy="12" r="8.5" />
            <circle cx="9.2" cy="11" r="1" />
            <circle cx="14.8" cy="11" r="1" />
            <path d="M9.5 15.5h5" />
          }
          @case ('dimmer') {
            <circle cx="12" cy="12" r="4" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
          }
          @case ('meter') {
            <path d="M4 16a8 8 0 0 1 16 0" />
            <path d="M12 16l4-4" />
            <path d="M4 19h16" />
          }
          @case ('sensor') {
            <circle cx="12" cy="12" r="1.8" />
            <path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6" />
            <path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8" />
          }
          @case ('gateway') {
            <rect x="3" y="13" width="18" height="7" rx="2" />
            <path d="M7 16.5h.01M11 16.5h4" />
            <path d="M8.5 8.5a5 5 0 0 1 7 0M6 6a8.5 8.5 0 0 1 12 0" />
          }
          @default {
            <rect x="4" y="4" width="16" height="16" rx="3" />
            <path d="M9 9h6v6H9z" />
          }
        }
      </svg>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.25rem;
      height: 2.25rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      /* Ein leeres Bildfeld soll als Platzhalter erkennbar sein, nicht als Fehler. */
      color: var(--text-muted);
      overflow: hidden;
    }

    .symbol {
      width: 1.4rem;
      height: 1.4rem;
    }

    .photo {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  `,
})
export class DeviceImageComponent {
  readonly kind = input.required<DeviceKind>();

  /** Pfad zum Produktfoto; `null` zeigt das Symbol zur Geräteart. */
  readonly photo = input<string | null>(null);

  /** Alternativtext des Fotos – die Modellkennung, sonst hätte es keine Beschriftung. */
  readonly alt = input('');
}
