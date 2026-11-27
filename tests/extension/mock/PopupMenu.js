// Minimaler Nachbau von GNOME Shells PopupMenu (seit GNOME 45 ein St.Widget)
// fuer die Kontextmenue-Tests.

import St from './St.js';

export class PopupMenuItem {
    constructor(label, callback) {
        this.label = label;
        this._callback = callback;
        this.actor = new St.Label({text: label});
    }

    activate() {
        this._callback?.();
    }
}

// Manager, der in GNOME Aussenklick und Escape schliesst. Der Mock haelt nur
// fest, ob ein Menue registriert wurde.
export class PopupMenuManager {
    constructor(owner, params = {}) {
        this.owner = owner;
        this.params = params;
        this.menus = [];
        this.destroyed = false;
    }

    addMenu(menu) {
        this.menus.push(menu);
        menu._manager = this;
    }

    removeMenu(menu) {
        this.menus = this.menus.filter(candidate => candidate !== menu);
    }

    destroy() {
        this.destroyed = true;
        this.menus = [];
    }
}

export class PopupSeparatorMenuItem {
    constructor() {
        this.actor = new St.Widget({name: 'popupSeparator'});
    }
}

export class PopupMenu extends St.BoxLayout {
    constructor(sourceActor, arrowAlignment, arrowSide, yPosition) {
        super({name: 'popupMenu'});
        this.sourceActor = sourceActor;
        this.arrowAlignment = arrowAlignment;
        this.arrowSide = arrowSide;
        this.yPosition = yPosition;
        this.items = [];
        this.isOpen = false;
    }

    addAction(title, callback) {
        const item = new PopupMenuItem(title, callback);
        this.items.push(item);
        this.add_child(item.actor);
        return item;
    }

    addMenuItem(item) {
        this.items.push(item);
        this.add_child(item.actor);
        return item;
    }

    open() {
        this.isOpen = true;
        this.emit('open-state-changed', true);
    }

    close() {
        if (!this.isOpen)
            return;
        this.isOpen = false;
        this.emit('open-state-changed', false);
    }

    destroy() {
        this.destroyed = true;
        super.destroy();
    }
}

export default {PopupMenu, PopupMenuItem, PopupMenuManager, PopupSeparatorMenuItem};
