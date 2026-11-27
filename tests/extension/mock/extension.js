// Ersatz fuer resource:///org/gnome/shell/extensions/extension.js
export class Extension {
    constructor(metadata = {}) {
        this.metadata = metadata;
        this.dir = metadata.dir ?? null;
    }

    getSettings() {
        throw new Error('getSettings() wird von dieser Extension nicht benutzt');
    }
}

export default {Extension};
