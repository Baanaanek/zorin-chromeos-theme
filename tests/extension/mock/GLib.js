// GLib-Ersatz: Pfade kommen aus der echten Umgebung des Harness.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export default {
    filename_from_uri(uri) {
        return [fileURLToPath(uri), ''];
    },

    path_get_dirname(p) {
        return path.dirname(p);
    },

    build_filenamev(parts) {
        return path.join(...parts);
    },

    get_user_data_dir() {
        return process.env.HARNESS_DATA_HOME;
    },

    get_home_dir() {
        return process.env.HARNESS_HOME;
    },

    file_test(p, mode) {
        try {
            if (mode === 2)
                fs.accessSync(p, fs.constants.X_OK);
            else
                fs.accessSync(p, fs.constants.R_OK);
            return true;
        } catch {
            return false;
        }
    },

    find_program_in_path(name) {
        for (const dir of (process.env.PATH || '').split(path.delimiter)) {
            if (!dir)
                continue;
            const candidate = path.join(dir, name);
            try {
                fs.accessSync(candidate, fs.constants.X_OK);
                return candidate;
            } catch {
                // weiter suchen
            }
        }
        return null;
    },

    FileTest: {
        IS_REGULAR: 1,
        IS_EXECUTABLE: 2,
        IS_DIR: 4,
    },
};
