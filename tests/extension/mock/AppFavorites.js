import {SignalSource} from './state.js';
import {favorites as pinned, installed} from './apps.js';

class AppFavorites extends SignalSource {
    constructor() {
        super(true);
    }

    getFavorites() {
        return [...pinned];
    }

    isFavorite(id) {
        return pinned.some(app => app.get_id() === id);
    }

    addFavorite(id) {
        if (this.isFavorite(id))
            return;
        const app = installed.find(candidate => candidate.get_id() === id);
        if (!app)
            return;
        pinned.push(app);
        this.emit('changed');
    }

    removeFavorite(id) {
        const index = pinned.findIndex(app => app.get_id() === id);
        if (index < 0)
            return;
        pinned.splice(index, 1);
        this.emit('changed');
    }
}

const favorites = new AppFavorites();

export function getAppFavorites() {
    return favorites;
}

export {favorites};
