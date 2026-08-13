# Produktfotos

Hierher gehören Produktfotos der Geräte, die in der Hersteller-Spalte der Geräteliste
erscheinen sollen. Nach dem Ablegen einer Datei muss die Modellkennung in `DEVICE_PHOTOS`
(`src/app/devices/vendor.ts`) eingetragen werden:

```ts
export const DEVICE_PHOTOS: Readonly<Record<string, string>> = {
  'SNSW-001X16EU': 'assets/devices/shelly-plus-1pm.webp',
};
```

Ohne Eintrag zeichnet die Oberfläche ein Symbol zur Geräteart — die Liste funktioniert also
auch ganz ohne Fotos.

**Lizenz beachten.** Produktfotos und Logos gehören ihren Herstellern (bei Shelly: Allterco
Robotics). Dieses Repository steht unter Apache-2.0 und liefert deshalb **keine** fremden
Bilder mit. Hier abgelegt werden dürfen nur Dateien, deren Weitergabe unter dieser Lizenz
geklärt ist — eigene Aufnahmen etwa, oder ausdrücklich freigegebenes Pressematerial.
Siehe REQUIREMENTS §4.5 und §6.
