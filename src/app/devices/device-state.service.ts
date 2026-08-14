import { Injectable, inject, signal } from '@angular/core';
import { ControlService, DeviceError, type DeviceErrorCode } from '../shelly/control.service';
import type { ShellyDevice } from '../shelly/shelly.model';
import type { CoverAction, DeviceStatus, SwitchAction } from '../shelly/status.model';

/**
 * Fehler eines Geräts – als Code, übersetzt wird erst beim Anzeigen (REQUIREMENTS §4.6).
 *
 * `unexpected` deckt ab, was gar kein `DeviceError` war: ein Fehler in der App selbst.
 * Er gehört nicht in den `ControlService`, der ihn nie auslöst.
 */
export interface DeviceFailure {
  code: DeviceErrorCode | 'unexpected';
  params: Record<string, string | number>;
}

/** Ist-Zustand und Bedienbarkeit eines Geräts. */
export interface DeviceState {
  /** `null`, solange nichts bestätigt ist: beim Laden und nach einem Fehlschlag. */
  status: DeviceStatus | null;
  /** Eine Abfrage oder ein Befehl läuft gerade. */
  busy: boolean;
  /** Fehler genau dieses Geräts – nie global, sonst wird die Liste unbrauchbar. */
  error: DeviceFailure | null;
  /** Passwortgeschützt: Aktionen gesperrt, bis die Geräte-Auth gebaut ist. */
  locked: boolean;
}

/** Zustand eines gerade gefundenen oder geladenen Geräts: Die Statusabfrage läuft. */
export const PENDING: DeviceState = { status: null, busy: true, error: null, locked: false };

/**
 * Hält den Ist-Zustand aller Geräte und führt die Schaltbefehle aus.
 *
 * Ein Dienst statt Komponentenzustand, weil beide Seiten dieselben Geräte anzeigen
 * (docs/plans/projekt-geraete.md): Ein Reiterwechsel darf nicht jede Statusabfrage von vorn
 * beginnen. Schlüssel ist die MAC – die IP wechselt per DHCP.
 */
@Injectable({ providedIn: 'root' })
export class DeviceStateService {
  private readonly control = inject(ControlService);

  private readonly states = signal<ReadonlyMap<string, DeviceState>>(new Map());

  /** Lesbarer Zustand für die Ansichten; ändert sich, sobald irgendein Gerät antwortet. */
  readonly all = this.states.asReadonly();

  /**
   * Laufende Nummer des jüngsten Vorgangs je Gerät.
   *
   * Zwei Vorgänge können gleichzeitig offen sein — „Stopp" darf während der Statusabfrage
   * nach einem Fahrbefehl durch (siehe `moveCover`). Ohne diese Nummer überschriebe die
   * spät eintreffende Antwort des älteren Vorgangs das Ergebnis des jüngeren: Ein
   * gescheiterter Stopp verschwände hinter einem „alles in Ordnung", das sich auf den
   * Zustand *vor* dem Stopp bezieht.
   */
  private readonly latest = new Map<string, number>();

  /** Bekannter Zustand eines Geräts; unbekannt heißt „Abfrage läuft". */
  stateFor(mac: string): DeviceState {
    return this.states().get(mac) ?? PENDING;
  }

  /**
   * Fragt den Ist-Zustand eines Geräts ab (REQUIREMENTS §4.2). Fehler bleiben am Gerät –
   * die Liste muss auch dann brauchbar bleiben, wenn eines nicht antwortet.
   */
  async loadStatus(device: ShellyDevice): Promise<void> {
    const vorgang = this.begin(device.mac);

    if (device.authEnabled) {
      // Ohne Geräte-Auth (REQUIREMENTS §4.3, eigener Schritt) käme nur ein 401 zurück.
      // Den Grund zeigen, statt das Gerät als „Fehler" abzustempeln.
      this.set(device.mac, {
        status: null,
        busy: false,
        error: { code: 'locked', params: {} },
        locked: true,
      });
      return;
    }

    // Der zuletzt bestätigte Zustand bleibt während der Abfrage stehen: Er ist das Letzte,
    // was das Gerät wirklich gemeldet hat — nur bedienen lässt er sich derweil nicht. Ihn
    // wegzuwerfen würde die Zeile bei jeder Nachfrage kurz zusammenklappen lassen.
    this.set(device.mac, { ...this.stateFor(device.mac), busy: true, error: null });
    try {
      const status = await this.control.getStatus(device);
      this.settle(device.mac, vorgang, { status, busy: false, error: null, locked: false });
    } catch (cause) {
      this.settle(device.mac, vorgang, failureFor(cause));
    }
  }

  /**
   * Schaltet einen Kanal und fragt danach den echten Zustand neu ab.
   *
   * Kein optimistisches UI: Was das Gerät aus dem Befehl gemacht hat, sagt nur das Gerät.
   */
  async switchChannel(device: ShellyDevice, channelId: number, action: SwitchAction): Promise<void> {
    const state = this.stateFor(device.mac);
    if (state.busy || state.locked) {
      return;
    }
    await this.command(device, () => this.control.setSwitch(device, channelId, action));
  }

  /**
   * Fährt einen Rollladen und fragt danach den echten Zustand neu ab.
   *
   * **Stopp geht auch, während eine Abfrage läuft.** Genau dann fährt der Rollladen ja –
   * die Statusabfrage nach dem Fahrbefehl läuft noch. Wäre der Knopf so lange gesperrt,
   * fehlte er ausgerechnet in dem Moment, für den er da ist.
   */
  async moveCover(device: ShellyDevice, coverId: number, action: CoverAction): Promise<void> {
    const state = this.stateFor(device.mac);
    if (state.locked || (state.busy && action !== 'stop')) {
      return;
    }
    await this.command(device, () => this.control.setCover(device, coverId, action));
  }

  /** Befehl abschicken, Fehler am Gerät festhalten, danach den Ist-Zustand nachfragen. */
  private async command(device: ShellyDevice, send: () => Promise<void>): Promise<void> {
    const vorgang = this.begin(device.mac);

    this.set(device.mac, { ...this.stateFor(device.mac), busy: true, error: null });
    try {
      await send();
    } catch (cause) {
      this.settle(device.mac, vorgang, failureFor(cause));
      return;
    }
    // `loadStatus` beginnt seinen eigenen Vorgang – dieser hier ist damit abgeschlossen.
    await this.loadStatus(device);
  }

  /** Meldet einen neuen Vorgang an; alle älteren gelten damit als überholt. */
  private begin(mac: string): number {
    const vorgang = (this.latest.get(mac) ?? 0) + 1;
    this.latest.set(mac, vorgang);
    return vorgang;
  }

  /**
   * Ergebnis eines Vorgangs übernehmen – aber nur, wenn ihn keiner überholt hat.
   *
   * Sonst räumte die späte Antwort auf einen älteren Befehl den Fehler des jüngeren weg,
   * oder zeigte einen Zustand von vor dem letzten Befehl als aktuell an.
   */
  private settle(mac: string, vorgang: number, state: DeviceState): void {
    if (this.latest.get(mac) === vorgang) {
      this.set(mac, state);
    }
  }

  private set(mac: string, state: DeviceState): void {
    // Neue Map statt Mutation: Signals vergleichen Referenzen, sonst rendert nichts nach.
    this.states.update((states) => new Map(states).set(mac, state));
  }
}

/**
 * Gescheiterte Abfrage oder gescheiterter Befehl.
 *
 * Der zuletzt bekannte Status fällt dabei weg: Ein Zustand, den das Gerät nicht bestätigt
 * hat, ist kein Ist-Zustand – ihn mit einer Fehlermeldung daneben stehen zu lassen wäre
 * genau das optimistische UI, das REQUIREMENTS §4.2 ausschließt.
 */
function failureFor(cause: unknown): DeviceState {
  const error: DeviceFailure =
    cause instanceof DeviceError
      ? { code: cause.code, params: cause.params }
      : { code: 'unexpected', params: {} };
  return { status: null, busy: false, error, locked: error.code === 'locked' };
}
