import * as fs from 'fs';
import {promisify} from 'util';




export const close = promisify(fs.close);
export const open = promisify(fs.open);
export const read = promisify(fs.read);
export const write = promisify(fs.write);
