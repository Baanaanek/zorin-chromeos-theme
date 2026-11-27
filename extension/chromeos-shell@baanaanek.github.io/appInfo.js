// Sichtbarkeit einer App: GNOME blendet NoDisplay-/OnlyShowIn-Eintraege aus.
// Shell.App bietet je nach Version should_show() selbst an, sonst haengt die
// Info am GDesktopAppInfo. Beides wird abgedeckt, damit Launcher und Shelf
// dieselbe Menge zeigen wie GNOME (appDisplay.js filtert genauso).

export function shouldShow(app) {
    try {
        if (typeof app?.should_show === 'function')
            return app.should_show();
        const info = app?.get_app_info?.();
        if (info)
            return info.should_show();
    } catch (e) {
        // Ohne AppInfo bleibt die App sichtbar.
    }
    return true;
}
