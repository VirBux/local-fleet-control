import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { MessageKey } from '../i18n/messages';
import { I18nService } from '../i18n/i18n.service';
import type { CoverAction, CoverState, SwitchAction } from '../shelly/status.model';
import { DeviceImageComponent } from './device-image.component';
import type { DeviceRow } from './device-row';

/** Rollladen-Zustand zu Textschlüssel. Als Tabelle, damit der Compiler die Lücken findet. */
const COVER_STATE_KEYS: Record<CoverState, MessageKey> = {
  open: 'cover.open',
  closed: 'cover.closed',
  opening: 'cover.opening',
  closing: 'cover.closing',
  stopped: 'cover.stopped',
  calibrating: 'cover.calibrating',
  unknown: 'cover.unknown',
};

/**
 * Eine Zeile der Geräteliste, für beide Seiten dieselbe.
 *
 * Was die Seiten unterscheidet, kommt per `<ng-content>` in die letzte Spalte: auf der
 * Discovery der „Hinzufügen"-Knopf, im Projekt der Zuordnungs-Editor. Die Zeile selbst —
 * Hersteller, Name, Ist-Zustand, Schaltflächen — ist beidesmal gleich und gehört deshalb
 * genau einmal beschrieben.
 *
 * Kein `<li>`: Die Liste ist ein `role="list"` aus `<div>`s, weil eine Komponente zwischen
 * `<ul>` und `<li>` kein gültiges HTML ergäbe.
 */
@Component({
  selector: 'app-device-row',
  imports: [DeviceImageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'listitem', class: 'device' },
  templateUrl: './device-row.component.html',
  styleUrl: './device-row.component.css',
})
export class DeviceRowComponent {
  readonly t = inject(I18nService).t;

  readonly row = input.required<DeviceRow>();

  readonly switchAction = output<SwitchAction>();
  readonly coverAction = output<CoverAction>();
  readonly retry = output<void>();

  /** Typ-Info hinter „erkannt, nicht steuerbar" – leer, wenn das Gerät nichts meldet. */
  readonly unsupportedInfo = computed(() => (this.row().state.status?.unsupported ?? []).join(', '));

  /**
   * Schalten ist gesperrt, solange etwas läuft, das Gerät gesperrt ist – oder der Zustand
   * nur aus dem Projekt stammt. Ein Knopf, der auf eine unbestätigte Adresse feuert, wäre
   * genau das Raten, das REQUIREMENTS §4.2 ausschließt.
   */
  readonly canSwitch = computed(() => {
    const { state, on } = this.row();
    return !state.busy && !state.locked && on !== null;
  });

  /** Dasselbe für Öffnen und Schließen. */
  readonly canMove = computed(() => {
    const { state, cover } = this.row();
    return !state.busy && !state.locked && cover !== null;
  });

  /**
   * Stopp bleibt klickbar, solange das Gerät nicht gesperrt ist – auch während einer
   * laufenden Abfrage und **auch nach einem Fehlschlag**. Genau dann fährt der Rollladen:
   * Ein Timeout während der Motorfahrt wirft den bestätigten Zustand weg, aber die
   * Rollladennummer steht trotzdem fest (sie kommt aus dem Projekt). Anders als Auf und Zu
   * setzt Stopp keinen gelesenen Zustand voraus – er ist nie geraten.
   */
  readonly canStop = computed(() => {
    const { state, channelType } = this.row();
    return !state.locked && channelType === 'cover';
  });

  /** Zustand des Rollladens in der eingestellten Sprache; leer, solange keiner feststeht. */
  readonly coverStateText = computed(() => {
    const cover = this.row().cover;
    return cover ? this.t(COVER_STATE_KEYS[cover.state]) : '';
  });
}
