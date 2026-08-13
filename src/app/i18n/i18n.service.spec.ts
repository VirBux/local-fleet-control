import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { PlatformService } from '../core/platform.service';
import { SETTINGS_FILE, StorageService, type StoreFile } from '../core/storage.service';
import { I18nService, LANGUAGE_STORAGE_KEY } from './i18n.service';

/**
 * Speicher-Double. Anders als in `project.service.spec.ts` merkt es sich auch die Datei:
 * Die Sprache gehört nach `settings.json`, nicht in die Projektablage, die einmal
 * exportiert werden soll (REQUIREMENTS §5).
 */
class FakeStorage {
  readonly entries = new Map<string, unknown>();

  /** Verzögert das Laden, um das Zeitfenster beim Start prüfen zu können. */
  gate: Promise<void> = Promise.resolve();

  constructor(vorbelegt?: { file: StoreFile; value: unknown }) {
    if (vorbelegt) {
      this.entries.set(`${vorbelegt.file}:${LANGUAGE_STORAGE_KEY}`, vorbelegt.value);
    }
  }

  async read(key: string, file: StoreFile): Promise<unknown> {
    await this.gate;
    return this.entries.get(`${file}:${key}`) ?? null;
  }

  async write(key: string, value: unknown, file: StoreFile): Promise<void> {
    this.entries.set(`${file}:${key}`, value);
  }
}

function setup(options: { system?: string[]; storage?: FakeStorage } = {}) {
  const storage = options.storage ?? new FakeStorage();
  const platform = { preferredLanguages: () => options.system ?? ['de-DE', 'de'] };

  TestBed.configureTestingModule({
    providers: [
      I18nService,
      { provide: StorageService, useValue: storage },
      { provide: PlatformService, useValue: platform },
    ],
  });

  return { service: TestBed.inject(I18nService), storage };
}

describe('I18nService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('startet in der Sprache des Systems', async () => {
    const { service } = setup({ system: ['fr-CH', 'fr'] });
    await service.ready;

    expect(service.language()).toBe('fr');
    expect(service.t('device.retry')).toBe('Réessayer');
  });

  it('fällt auf Englisch zurück, wenn das System eine fremde Sprache meldet', async () => {
    const { service } = setup({ system: ['ja-JP'] });
    await service.ready;

    expect(service.language()).toBe('en');
  });

  it('zieht die gespeicherte Sprache der des Systems vor', async () => {
    const storage = new FakeStorage({ file: SETTINGS_FILE, value: 'hr' });
    const { service } = setup({ system: ['de'], storage });
    await service.ready;

    expect(service.language()).toBe('hr');
    expect(service.t('device.retry')).toBe('Pokušaj ponovno');
  });

  it('übergeht einen unbrauchbaren gespeicherten Wert', async () => {
    const storage = new FakeStorage({ file: SETTINGS_FILE, value: 'klingonisch' });
    const { service } = setup({ system: ['es'], storage });
    await service.ready;

    expect(service.language()).toBe('es');
  });

  it('speichert die Wahl in settings.json, nicht in der Projektablage', async () => {
    const { service, storage } = setup();
    await service.ready;

    service.setLanguage('en');

    expect(service.language()).toBe('en');
    expect(storage.entries.get(`${SETTINGS_FILE}:${LANGUAGE_STORAGE_KEY}`)).toBe('en');
    expect([...storage.entries.keys()]).toEqual([`${SETTINGS_FILE}:${LANGUAGE_STORAGE_KEY}`]);
  });

  it('lässt eine Wahl während des Ladens nicht überschreiben', async () => {
    // Die Ablage ist eine Datei: Zwischen Start und geladenem Wert liegt ein Moment, in
    // dem der Nutzer schon umstellen kann. Seine Wahl gewinnt.
    const storage = new FakeStorage({ file: SETTINGS_FILE, value: 'hr' });
    let öffnen = () => {};
    storage.gate = new Promise((resolve) => (öffnen = resolve));

    const { service } = setup({ system: ['de'], storage });
    service.setLanguage('fr');
    öffnen();
    await service.ready;

    expect(service.language()).toBe('fr');
  });

  it('setzt Platzhalter ein', () => {
    const { service } = setup();

    expect(service.t('range.tooLarge', { hosts: 4096, max: 1024 })).toContain('4096');
  });

  it('wechselt mit der Sprache auch schon gelesene Texte', async () => {
    const { service } = setup({ system: ['de'] });
    await service.ready;
    expect(service.t('device.retry')).toBe('Erneut versuchen');

    service.setLanguage('es');

    expect(service.t('device.retry')).toBe('Reintentar');
  });

  it('hält das lang-Attribut des Dokuments nach', async () => {
    const { service } = setup({ system: ['de'] });
    await service.ready;
    expect(document.documentElement.lang).toBe('de');

    service.setLanguage('hr');

    expect(document.documentElement.lang).toBe('hr');
  });
});
