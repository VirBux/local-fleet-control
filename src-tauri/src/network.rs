//! Ermittelt die lokalen IPv4-Netze dieses Rechners.
//!
//! Das ist der einzige Teil der Discovery, der nativen Code braucht: Aus dem WebView
//! heraus kommt man an Netzwerk-Interfaces nicht heran. Alles Weitere (Host-Liste
//! berechnen, HTTP-Sweep, Antwort auswerten) passiert in TypeScript.
//! Siehe docs/plans/netzwerk-scan.md.

use serde::Serialize;

/// Ein aktives IPv4-Netz dieses Rechners.
///
/// `Serialize` (aus serde) erlaubt Tauri, die Struct automatisch nach JSON zu wandeln.
/// `rename_all = "camelCase"` sorgt dafür, dass aus dem Rust-Feld `prefix_len` im
/// TypeScript `prefixLen` wird – jede Seite behält so ihre übliche Schreibweise.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalNetwork {
    /// Name des Interfaces, z. B. "WLAN" oder "Ethernet".
    pub interface: String,
    /// Eigene IPv4-Adresse in diesem Netz, z. B. "192.168.1.42".
    pub ip: String,
    /// Subnetzmaske, z. B. "255.255.255.0".
    pub netmask: String,
    /// Präfixlänge, z. B. 24 für ein /24-Netz.
    pub prefix_len: u8,
}

/// Liefert alle nutzbaren IPv4-Netze dieses Rechners.
///
/// Bewusst eine *Liste* und kein einzelner Treffer: Ein Rechner kann in mehreren Netzen
/// gleichzeitig hängen (WLAN und LAN, VPN, Docker-Bridges). Welches davon gescannt wird,
/// entscheidet die UI – nicht dieser Code.
///
/// Der Rückgabetyp `Result<_, String>` wird auf der TypeScript-Seite zu einem Promise:
/// `Ok` löst es auf, `Err` lässt es mit der Fehlermeldung als Grund fehlschlagen.
#[tauri::command]
pub fn list_local_networks() -> Result<Vec<LocalNetwork>, String> {
    // `?` gibt bei einem Fehler sofort aus der Funktion zurück. Da unser Fehlertyp String
    // ist, der von if_addrs aber io::Error, wandelt `map_err` ihn vorher um.
    let interfaces = if_addrs::get_if_addrs().map_err(|e| e.to_string())?;

    let networks = interfaces
        .into_iter()
        // Interfaces, die zwar existieren, aber nicht laufen (getrenntes LAN-Kabel,
        // deaktiviertes WLAN), sind für einen Scan wertlos.
        .filter(|iface| iface.is_oper_up())
        // `filter_map` filtert und wandelt in einem Schritt: `None` verwirft den Eintrag,
        // `Some(x)` übernimmt x in das Ergebnis.
        .filter_map(|iface| match &iface.addr {
            // Nur IPv4. Loopback (127.x) und Link-Local (169.254.x, "APIPA" – vergeben,
            // wenn kein DHCP antwortet) enthalten keine erreichbaren Geräte.
            if_addrs::IfAddr::V4(v4) if !v4.is_loopback() && !v4.is_link_local() => {
                Some(LocalNetwork {
                    interface: iface.name.clone(),
                    ip: v4.ip.to_string(),
                    netmask: v4.netmask.to_string(),
                    prefix_len: v4.prefixlen,
                })
            }
            _ => None,
        })
        .collect();

    Ok(networks)
}
