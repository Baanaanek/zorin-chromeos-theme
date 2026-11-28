// Minimaler Nachbau der St-Actors, die die Extension benutzt.
// Verhalten, auf das die Pruefungen zugreifen: Kinder, Eltern, Sichtbarkeit,
// Groesse/Position, Style-Klassen, Signale.

import {SignalSource, state} from './state.js';

class ClutterText extends SignalSource {
    constructor(owner) {
        super();
        this._owner = owner;
        this._text = '';
    }

    set_line_wrap() {}
    set_line_wrap_mode() {}
    set_ellipsize() {}
    set_line_alignment() {}
    get_text() {
        return this._text;
    }
}

export class Actor extends SignalSource {
    constructor(params = {}) {
        super();
        this.name = params.name ?? null;
        this.style_class = params.style_class ?? null;
        this.styleClasses = new Set(
            String(params.style_class ?? '').split(/\s+/).filter(Boolean));
        this.visible = params.visible ?? true;
        this.reactive = !!params.reactive;
        this.can_focus = !!params.can_focus;
        this.track_hover = !!params.track_hover;
        this.x_expand = !!params.x_expand;
        this.y_expand = !!params.y_expand;
        this.x_align = params.x_align ?? null;
        this.y_align = params.y_align ?? null;
        this.layout_manager = params.layout_manager ?? null;
        this.icon_name = params.icon_name ?? null;
        this.icon_size = params.icon_size ?? null;
        this.gicon = params.gicon ?? null;
        this._preferredHeight = params._preferred_height ?? 56;
        this._children = [];
        this._parent = null;
        this._destroyed = false;
        this.width = 0;
        this.height = 0;
        this.x = 0;
        this.y = 0;
        this._text = params.text ?? '';
        this.clutter_text = new ClutterText(this);
        if ('child' in params && params.child)
            this.set_child(params.child);
    }

    add_child(child) {
        child._parent = this;
        this._children.push(child);
    }

    remove_child(child) {
        const index = this._children.indexOf(child);
        if (index >= 0) {
            this._children.splice(index, 1);
            child._parent = null;
        }
    }

    insert_child_at_index(child, index) {
        const at = Math.max(0, Math.min(index, this._children.length));
        child._parent = this;
        this._children.splice(at, 0, child);
    }

    get_children() {
        return [...this._children];
    }

    get_n_children() {
        return this._children.length;
    }

    get_parent() {
        return this._parent;
    }

    // Wie St: der zuletzt fokussierte Actor; der Harness prueft damit, wohin
    // die Tastaturnavigation springt.
    grab_key_focus() {
        state.keyFocus = this;
    }

    has_key_focus() {
        return state.keyFocus === this;
    }

    destroy_all_children() {
        for (const child of [...this._children])
            child.destroy();
        this._children = [];
    }

    destroy() {
        if (this._destroyed)
            return;
        this.destroy_all_children();
        if (this._parent)
            this._parent.remove_child(this);
        this._destroyed = true;
        this._handlers.clear();
    }

    show() {
        this.visible = true;
    }

    hide() {
        this.visible = false;
    }

    set_size(width, height) {
        this.width = width;
        this.height = height;
    }

    set_width(width) {
        this.width = width;
    }

    set_height(height) {
        this.height = height;
    }

    set_position(x, y) {
        this.x = x;
        this.y = y;
    }

    set_x(x) {
        this.x = x;
    }

    set_y(y) {
        this.y = y;
    }

    get_preferred_height(_width) {
        return [this.width || 100, this._preferredHeight];
    }

    // Im Mock gibt es kein Layout; die Position ist die gesetzte. Der
    // Harness setzt sie, wo er das Scrollen prueft.
    get_transformed_position() {
        return [this.x, this.y];
    }

    add_style_class_name(name) {
        this.styleClasses.add(name);
    }

    remove_style_class_name(name) {
        this.styleClasses.delete(name);
    }

    has_style_class_name(name) {
        return this.styleClasses.has(name);
    }

    grab_key_focus() {
        state.keyFocus = this;
    }

    has_key_focus() {
        return state.keyFocus === this;
    }

    set_child() {}
    get_text() {
        return this._text;
    }
    set_text(text) {
        this._text = text;
    }
}

export class Widget extends Actor {}
export class BoxLayout extends Actor {}
export class Icon extends Actor {}

export class Label extends Actor {}

export class Button extends Actor {
    set_child(child) {
        if (this._child)
            this.remove_child(this._child);
        this._child = child;
        if (child)
            this.add_child(child);
    }
}

export class Entry extends Actor {
    constructor(params = {}) {
        super(params);
        this.hint_text = params.hint_text ?? '';
    }

    set_text(text) {
        this._text = text;
        this.clutter_text._text = text;
        this.clutter_text.emit('text-changed');
    }
}

// Adjustment wie bei Clutter: Wert, Inhalt und Seitengroesse, dazu Signale.
function makeAdjustment(upper = 0, pageSize = 0) {
    const adjustment = new SignalSource();
    adjustment.value = 0;
    adjustment.upper = upper;
    adjustment.page_size = pageSize;
    return adjustment;
}

export class ScrollView extends Actor {
    constructor(params = {}) {
        super(params);
        this.vscroll = {adjustment: makeAdjustment()};
        this.hscroll = {adjustment: makeAdjustment()};
    }

    set_child(child) {
        this._child = child;
        this.add_child(child);
    }
}

export class Bin extends Actor {
    set_child(child) {
        this._child = child;
        this.add_child(child);
    }
}

export {makeAdjustment};

export const Theme = class Theme {
    load_stylesheet(file) {
        this._loaded = file;
        state.themeLoads.push(file);
        return true;
    }

    unload_stylesheet(file) {
        state.themeUnloads.push(file);
        return true;
    }
};

export const ThemeContext = class ThemeContext {
    constructor() {
        this._theme = new Theme();
    }

    static get_for_stage(_stage) {
        return new ThemeContext();
    }

    get_theme() {
        return this._theme;
    }
};

export default {
    Actor,
    Widget,
    BoxLayout,
    Label,
    Button,
    Entry,
    Icon,
    ScrollView,
    Bin,
    Theme,
    ThemeContext,
    PolicyType: {NEVER: 'never', AUTOMATIC: 'automatic', ALWAYS: 'always'},
    Side: {TOP: 'top', BOTTOM: 'bottom', LEFT: 'left', RIGHT: 'right'},
};
