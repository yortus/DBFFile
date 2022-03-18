import * as fs from 'fs';
import {promisify} from 'util';
import {FileSystem} from './dbf-file';



/** Promisified version of fs.stat. */
export const stat = promisify(fs.stat);

class Fs implements FileSystem {
    open = promisify(fs.open)
    close = promisify(fs.close)
    read = promisify(fs.read)
    write = promisify(fs.write)
    exists = async function (path: string) {
        try {
            await stat(path);
            return true;
        } catch {
            return false;
        }

    }
    fileSize = async function (path: string) {
        const stats = await stat(path);
        return stats.size;
    }
}

export default new Fs();