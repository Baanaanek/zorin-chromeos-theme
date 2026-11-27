import St from './St.js';
import {SignalSource, state} from './state.js';

// GNOME-Panel: Statusbereich mit Datum, Schnelleinstellungen und einer
// weiteren Schaltflaeche davor/dahinter.
class Panel extends SignalSource {
    constructor() {
        super(true);
        this.visible = true;
        this.statusArea = new St.Widget({name: 'panelStatusArea'});
        this.dateMenu = {container: new St.Widget({name: 'dateMenuContainer'})};
        this.quickSettings = {container: new St.Widget({name: 'quickSettingsContainer'})};
        this.network = {container: new St.Widget({name: 'networkContainer'})};
        // In GNOME haengen die Menues am Statusbereich, nicht am Panel.
        this.statusArea.dateMenu = this.dateMenu;
        this.statusArea.quickSettings = this.quickSettings;
        this.statusArea.add_child(this.dateMenu.container);
        this.statusArea.add_child(this.quickSettings.container);
        this.statusArea.add_child(this.network.container);
    }

    hide() {
        this.visible = false;
        state.panelHides++;
    }

    show() {
        this.visible = true;
        state.panelShows++;
    }
}

class LayoutManager extends SignalSource {
    constructor() {
        super(true);
        this.primaryMonitor = {x: 0, y: 0, width: 1920, height: 1080};
        this.chrome = [];
        this.topChrome = [];
        this.calls = [];
    }

    addChrome(actor, params) {
        this.chrome.push(actor);
        this.calls.push({actor, params, top: false});
    }

    addTopChrome(actor, params) {
        this.topChrome.push(actor);
        this.calls.push({actor, params, top: true});
    }

    removeChrome(actor) {
        this.chrome = this.chrome.filter(a => a !== actor);
        this.topChrome = this.topChrome.filter(a => a !== actor);
    }
}

class Overview extends SignalSource {
    constructor() {
        super(true);
        this.hides = 0;
    }

    hide() {
        this.hides++;
    }
}

class Display extends SignalSource {
    constructor() {
        super(true);
        this.focus_window = null;
    }
}

export const panel = new Panel();
export const layoutManager = new LayoutManager();
export const overview = new Overview();
export const display = new Display();
export const stage = new St.Widget({name: 'stage'});

export function activateWindow(window) {
    state.activated.push(window);
}
