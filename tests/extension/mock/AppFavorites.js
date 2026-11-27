import {SignalSource} from './state.js';
import {favorites as pinned} from './apps.js';

class AppFavorites extends SignalSource {
    constructor() {
        super(true);
    }

    getFavorites() {
        return [...pinned];
    }
}

const favorites = new AppFavorites();

export function getAppFavorites() {
    return favorites;
}

export {favorites};
