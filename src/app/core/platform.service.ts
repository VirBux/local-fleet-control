import { Injectable } from '@angular/core';
import { getVersion } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';

/**
 * Kapselt die Zugriffe auf die Tauri-Brücke, die nicht schon in einem Fachdienst
 * liegen.
 *
 * Warum eine eigene Klasse statt direkter Importe in den Komponenten: Der
 * `@angular/build:unit-test`-Builder bündelt Spec-Dateien vorab mit esbuild, wodurch
 * `vi.mock()` auf Modulpfade **nicht** greift (nachgemessen). Über Dependency Injection
 * lassen sich diese Aufrufe dagegen zuverlässig ersetzen. Zweiter Nutzen: Unter
 * `ng serve` im normalen Browser gibt es keine Tauri-Brücke – hier ist die einzige
 * Stelle, die das abfangen muss.
 */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  /** Anwendungsversion aus tauri.conf.json; leer, wenn nicht in Tauri gelaufen. */
  async getAppVersion(): Promise<string> {
    try {
      return await getVersion();
    } catch {
      return '';
    }
  }

  /** Öffnet eine URL im System-Browser statt im App-Fenster. */
  async openExternal(url: string): Promise<void> {
    await openUrl(url);
  }
}
