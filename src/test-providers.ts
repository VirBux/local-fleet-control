import { provideZonelessChangeDetection } from '@angular/core';

/**
 * Provider für die Testumgebung – vom `unit-test`-Builder eingebunden
 * (`providersFile` in angular.json).
 *
 * Muss zur Anwendung passen: Läuft die App zoneless, müssen es die Tests auch,
 * sonst prüfen sie ein anderes Change-Detection-Verhalten als die Produktion.
 */
export default [provideZonelessChangeDetection()];
