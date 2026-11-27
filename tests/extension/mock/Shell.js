import {SignalSource} from './state.js';
import {installed, running} from './apps.js';

export const appSystem = new SignalSource(true);

appSystem.get_installed = () => [...installed];
appSystem.get_running = () => [...running];
appSystem.lookup_app = id => installed.find(app => app.get_id() === id) ?? null;

export default {
    AppSystem: {
        get_default: () => appSystem,
    },
};
