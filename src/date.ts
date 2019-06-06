/** Parses an 8-character date string of the form 'YYYYMMDD' into a Date object. */
export function parseDate(s: string): Date {
    return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
}




/** Formats the given date as a string, in 8-character 'YYYYMMDD' format. */
export function formatDate(d: Date): string {
    return d.toISOString().slice(0, 10).replace(/\-/, '');
}
