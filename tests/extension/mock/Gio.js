// Gio-Ersatz: Settings mit Signal, Dateien, Subprozesse (aufgezeichnet).

import {SignalSource, state} from './state.js';

const DEFAULTS = {
    'org.gnome.desktop.interface': {'color-scheme': 'default'},
};

export const settingsInstances = [];

// Wie dconf: alle Instanzen desselben Schemas sehen denselben Wert und
// bekommen dieselben Aenderungssignale. Sonst saehe theme.js einen Wechsel
// nicht, nur weil die Extension eine eigene Gio.Settings-Instanz haelt.
const stores = new Map();

function storeFor(schemaId) {
    if (!stores.has(schemaId))
        stores.set(schemaId, new Map(Object.entries(DEFAULTS[schemaId] ?? {})));
    return stores.get(schemaId);
}

export class Settings extends SignalSource {
    constructor(params = {}) {
        super(true);
        this.schema_id = params.schema_id;
        this._values = storeFor(this.schema_id);
        settingsInstances.push(this);
    }

    get_string(key) {
        return this._values.get(key) ?? '';
    }

    set_string(key, value) {
        this._set(key, value);
    }

    // Nur fuer den Harness.
    _force(key, value) {
        this._set(key, value);
    }

    _set(key, value) {
        this._values.set(key, value);
        for (const settings of settingsInstances) {
            if (settings.schema_id === this.schema_id)
                settings.emit(`changed::${key}`);
        }
    }
}

export class File {
    constructor(path) {
        this.path = path;
    }

    static new_for_path(path) {
        return new File(path);
    }

    get_path() {
        return this.path;
    }
}

export class FileIcon {
    constructor(params = {}) {
        this.file = params.file;
    }
}

export class Subprocess {
    constructor(argv) {
        this.argv = argv;
        this._stdout = argv.includes('--engine-name') ? 'DuckDuckGo\n' : '';
        this.communicate_utf8_async = (_stdin, _cancellable, callback) => {
            callback(this, null);
        };
        this.communicate_utf8_finish = () => [true, this._stdout];
    }

    static new(argv, flags) {
        state.subprocess.push({argv, flags});
        return new Subprocess(argv);
    }
}

export const SubprocessFlags = {
    NONE: 0,
    STDOUT_SILENCE: 1,
    STDERR_SILENCE: 2,
    STDOUT_PIPE: 4,
    STDERR_PIPE: 8,
};

export const AppInfo = {
    launch_default_for_uri(uri, _context) {
        state.appInfoUris.push(uri);
    },
};

export function lastInterfaceSettings() {
    return settingsInstances.filter(s => s.schema_id === 'org.gnome.desktop.interface').pop();
}

export default {Settings, File, FileIcon, Subprocess, SubprocessFlags, AppInfo};
