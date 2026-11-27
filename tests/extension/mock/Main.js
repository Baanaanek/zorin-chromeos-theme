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
        // Statusanzeigen wie in GNOME 46. Tastaturbelegung ist sichtbar,
        // Aufnahme und Freigabe erst waehrend Aufnahme/Freigabe.
        this.keyboard = {container: new St.Widget({name: 'keyboardContainer'})};
        this.screenRecording = {
            container: new St.Widget({name: 'screenRecordingContainer', visible: false}),
        };
        this.remoteAccess = {
            container: new St.Widget({name: 'remoteAccessContainer', visible: false}),
        };
        // In GNOME haengen die Menues am Statusbereich, nicht am Panel;
        // nachgeschlagen wird jede Rolle ueber Main.panel.statusArea[role].
        this.statusArea.dateMenu = this.dateMenu;
        this.statusArea.quickSettings = this.quickSettings;
        this.statusArea.keyboard = this.keyboard;
        this.statusArea.screenRecording = this.screenRecording;
        this.statusArea.remoteAccess = this.remoteAccess;
        this.statusArea.add_child(this.dateMenu.container);
        this.statusArea.add_child(this.quickSettings.container);
        this.statusArea.add_child(this.network.container);
        this.statusArea.add_child(this.keyboard.container);
        this.statusArea.add_child(this.screenRecording.container);
        this.statusArea.add_child(this.remoteAccess.container);
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

// Session-Modus wie in GNOME 46: Eigenschaft isLocked, Aenderungen kommen
// ueber 'updated' (sessionMode.js _sync), nicht ueber Polling.
class SessionMode extends SignalSource {
    constructor() {
        super(true);
        this.isLocked = false;
    }

    setLocked(locked) {
        this.isLocked = locked;
        this.emit('updated');
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
export const sessionMode = new SessionMode();
export const display = new Display();
export const stage = new St.Widget({name: 'stage'});
export const uiGroup = new St.Widget({name: 'uiGroup'});

export function activateWindow(window) {
    state.activated.push(window);
}
