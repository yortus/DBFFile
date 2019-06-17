import {encodingExists} from 'iconv-lite';




/** Options for opening or creating a DBF file. */
export interface Options {

    /** The default character encoding to use when reading/writing the DBF file. */
    encoding: string;
}




/** Validates the given options and substitutes defaults for missing properties. Returns a new options object. */
export function normaliseOptions(options?: Partial<Options>): Options {
    options = options || {};

    // Validate `encoding`.
    let encoding = options.encoding || 'ISO-8859-1';
    if (!encodingExists(encoding)) throw new Error(`Unsupported character encoding '${encoding}'`);

    // Return a new options object.
    return {encoding};
}
