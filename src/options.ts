import {encodingExists} from 'iconv-lite';




/** Options for opening or creating a DBF file. */
export interface Options {

    /** The character encoding(s) to use when reading/writing the DBF file. */
    encoding: Encoding;
}




/**
 * Character encoding. Either a string, which applies to all fields, or an object whose keys are field names and
 * whose values are encodings. If given as an object, field keys are all optional, but a 'default' key is required.
 * Valid encodings may be found here: https://github.com/ashtuchkin/iconv-lite/wiki/Supported-Encodings
 */
export type Encoding = string | {default: string, [fieldName: string]: string};




/** Validates the given options and substitutes defaults for missing properties. Returns a new options object. */
export function normaliseOptions(options?: Partial<Options>): Options {
    options = options || {};

    // Validate `encoding`.
    let encoding = options.encoding || 'ISO-8859-1';
    if (typeof encoding === 'string') {
        if (!encodingExists(encoding)) throw new Error(`Unsupported character encoding '${encoding}'`);
    }
    else if (typeof encoding === 'object') {
        if (!encoding.default) throw new Error(`No default encoding specified`);
        for (let key of Object.keys(encoding)) {
            if (!encodingExists(encoding[key])) throw new Error(`Unsupported character encoding '${encoding}'`);
        }
    }
    else {
        throw new Error(`Invalid encoding value ${encoding}`);
    }

    // Return a new options object.
    return {encoding};
}
