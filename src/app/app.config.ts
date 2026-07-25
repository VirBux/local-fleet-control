import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Ohne Zone.js: Angular aktualisiert die Ansicht, wenn sich Signals ändern
    // (REQUIREMENTS §3). Zustand deshalb konsequent in Signals halten – Werte, die
    // nur in normalen Feldern liegen, lösen kein Rendering aus.
    provideZonelessChangeDetection(),
    provideRouter(routes),
  ],
};
