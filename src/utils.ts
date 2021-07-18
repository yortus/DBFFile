import * as fs from 'fs';
import {promisify} from 'util';




/** Promisified version of fs.close. */
export const close = promisify(fs.close);




/** Promisified version of fs.open. */
export const open = promisify(fs.open);




/** Promisified version of fs.read. */
export const read = promisify(fs.read);




/** Promisified version of fs.stat. */
export const stat = promisify(fs.stat);




/** Promisified version of fs.write. */
export const write = promisify(fs.write);




/** Creates a date with no local timezone offset. `month` and `day` are 1-based. */
export function createDate(year: number, month: number, day: number): Date {
    const yyyy = String(year).padStart(4, '0');
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return new Date(`${yyyy}-${mm}-${dd}`);
}



/** Parses an 8-character date string of the form 'YYYYMMDD' into a UTC Date object. */
export function parse8CharDate(s: string): Date {
    return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
}




/** Formats the given Date object as a string, in 8-character 'YYYYMMDD' format. `d` is assumed to be in UTC. */
export function format8CharDate(d: Date): string {
    return d.toISOString().slice(0, 10).replace(/-/g, '');
}




/** Parses the given Visual FoxPro DateTime representation into a UTC Date object. */
export function parseVfpDateTime(dt: {julianDay: number, msSinceMidnight: number}): Date {
    // Compute year/month/day
    const s1 = dt.julianDay + 68569;
    const n = Math.floor(4 * s1 / 146097);
    const s2 = s1 - Math.floor(((146097 * n) + 3) / 4);
    const i = Math.floor(4000 * (s2 + 1) / 1461001);
    const s3 = s2 - Math.floor(1461 * i / 4) + 31;
    const q = Math.floor(80 * s3 / 2447);
    const s4 = Math.floor(q / 11);
    const year = (100 * (n - 49)) + i + s4;
    const month = q + 2 - (12 * s4);
    const day = s3 - Math.floor(2447 * q / 80);

    // Compute hour/minute/second
    const secsSinceMidnight = Math.floor(dt.msSinceMidnight / 1_000);
    const minsSinceMidnight = Math.floor(secsSinceMidnight / 60);
    const second = secsSinceMidnight % 60;
    const minute = minsSinceMidnight % 60;
    const hour = Math.floor(minsSinceMidnight / 60);
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}




/** Formats the given Date object as a Visual FoxPro DateTime representation. `d` is assumed to be in UTC. */
export function formatVfpDateTime(d: Date): {julianDay: number, msSinceMidnight: number} {
    // Compute year/month/day
    const msPerDay = 86_400_000;
    const daysFromEpoch = Math.floor(d.getTime() / msPerDay);
    const julianDaysBeforeEpoch = 2_440_588;
    const julianDay = Math.floor(daysFromEpoch + julianDaysBeforeEpoch);

    // Compute milliseconds since midnight
    const hrs = d.getUTCHours();
    const mins = d.getUTCMinutes();
    const secs = d.getUTCSeconds();
    const msSinceMidnight = (((hrs * 60 + mins) * 60) + secs) * 1_000;
    return {julianDay, msSinceMidnight};
}
