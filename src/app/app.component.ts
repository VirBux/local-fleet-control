import { Component, signal } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";

@Component({
  selector: "app-root",
  imports: [RouterOutlet],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent {
  /** Version aus tauri.conf.json – im Browser (ng serve) nicht verfügbar. */
  readonly version = signal("");

  constructor() {
    getVersion()
      .then((v) => this.version.set(v))
      .catch(() => this.version.set(""));
  }

  /** Externe Links im System-Browser öffnen, nicht im App-Fenster. */
  openHomepage(event: Event): void {
    event.preventDefault();
    void openUrl("https://ha-fleet-manager.com");
  }
}
