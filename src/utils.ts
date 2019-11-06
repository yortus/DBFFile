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




/** Parses an 8-character date string of the form 'YYYYMMDD' into a Date object. */
export function parseDate(s: string): Date {
    return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
}




/** Parses an 8-character date string of the form 'YYYYMMDD' into a Date object. */
export function parseDateTime(dateWord: number, timeWord: number): Date {

    const date = getDateFromJulianDateInt(dateWord);
    const time = getTimeFromInt(timeWord);

    return new Date(`${date} ${time}`);
}




const padLeft = (stringOrNumber: string | number, count: number, character: string = '0'): string => {
    let paddedString = stringOrNumber.toString();

    while (paddedString.length < count) {
        paddedString = character + paddedString;
    }

    return paddedString;
};




// Please see http://en.wikipedia.org/wiki/Julian_day
const getDateFromJulianDateInt = (dateInt: number): string => {
    if (dateInt === 0) {
        return new Date(Number.MIN_VALUE).toDateString();
    }

    const s1 = dateInt + 68569;
    const n = Math.floor(4 * s1 / 146097);
    const s2 = s1 - Math.floor(((146097 * n) + 3) / 4);
    const i = Math.floor(4000 * (s2 + 1) / 1461001);
    const s3 = s2 - Math.floor(1461 * i / 4) + 31;
    const q = Math.floor(80 * s3 / 2447);
    const s4 = Math.floor(q / 11);

    const year = (100 * (n - 49)) + i + s4;
    const month = q + 2 - (12 * s4);
    const day = s3 - Math.floor(2447 * q / 80);

    return `${padLeft(year, 4)}-${padLeft(month, 2)}-${padLeft(day, 2)}`;
}




const getTimeFromInt = (timeInt: number): string => {
    const hours = Math.trunc(timeInt / 3_600_000);

    const hoursRemainder = timeInt % 3_600_000;
    const minutes = Math.trunc(hoursRemainder / 60_000);

    const minutesRemainder = minutes % 60_000;
    const seconds = Math.trunc(minutesRemainder / 1_000);

    return `${padLeft(hours, 2)}:${padLeft(minutes, 2)}:${padLeft(seconds, 2)} GMT`;
};




/** Formats the given date as a string, in 8-character 'YYYYMMDD' format. */
export function formatDate(d: Date): string {
    return d.toISOString().slice(0, 10).replace(/-/g, '');
}
