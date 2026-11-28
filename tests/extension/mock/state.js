// Gemeinsamer Zustand der GNOME-Mocks.
// Nur Objekte, die eine Sitzung ueberleben (Panel, LayoutManager, AppSystem,
// Favoriten, Overview, Einstellungen, Display), werden als "tracked" gefuehrt.
// So laesst sich am Ende pruefen, ob disable() wirklich alle Signale loest.

export const live = {handlers: 0};

export class SignalSource {
    constructor(tracked = false) {
        this._handlers = new Map();
        this._nextId = 1;
        this._tracked = tracked;
    }

    connect(signal, callback) {
        const id = this._nextId++;
        this._handlers.set(id, {signal, callback});
        if (this._tracked)
            live.handlers++;
        return id;
    }

    disconnect(id) {
        if (!this._handlers.has(id))
            throw new Error(`disconnect(): unbekannte Signal-ID ${id}`);
        this._handlers.delete(id);
        if (this._tracked)
            live.handlers--;
    }

    emit(signal, ...args) {
        let result;
        for (const {signal: name, callback} of [...this._handlers.values()]) {
            if (name === signal)
                result = callback(this, ...args);
        }
        return result;
    }

    openSignals() {
        return this._handlers.size;
    }
}

export const state = {
    subprocess: [],
    activated: [],
    panelHides: 0,
    panelShows: 0,
    themeLoads: [],
    themeUnloads: [],
    appInfoUris: [],
    closedWindows: [],
    keyFocus: null,
};
