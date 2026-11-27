// Websuche ueber den Helfer bin/chromeos-search-url.
// Der Helfer liest die Standardsuchmaschine des Standardbrowsers.
// Kein Google als Vorgabe, keine KI-, Assistant- oder Lens-Funktionen.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const HELPER = 'chromeos-search-url';

function helperPath() {
    const local = GLib.build_filenamev([GLib.get_home_dir(), '.local', 'bin', HELPER]);
    if (GLib.file_test(local, GLib.FileTest.IS_EXECUTABLE))
        return local;
    return GLib.find_program_in_path(HELPER);
}

export function isAvailable() {
    return helperPath() !== null;
}

export function openWebSearch(query) {
    const helper = helperPath();
    if (!helper) {
        console.warn('[chromeos-shell] Suchhelfer chromeos-search-url fehlt.');
        return false;
    }
    try {
        Gio.Subprocess.new([helper, '--open', query],
            Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE);
        return true;
    } catch (e) {
        console.error(`[chromeos-shell] Suche konnte nicht geoeffnet werden: ${e}`);
        return false;
    }
}

export function getEngineName(callback) {
    const helper = helperPath();
    if (!helper) {
        callback(null);
        return;
    }
    try {
        const proc = Gio.Subprocess.new([helper, '--engine-name'],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
        proc.communicate_utf8_async(null, null, (p, res) => {
            try {
                const [, stdout] = p.communicate_utf8_finish(res);
                const name = (stdout || '').trim();
                callback(name || null);
            } catch (e) {
                callback(null);
            }
        });
    } catch (e) {
        callback(null);
    }
}
