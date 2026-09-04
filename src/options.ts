import {encodingExists} from 'iconv-lite';
import {FileVersion, isValidFileVersion} from './file-version';




/** Options for opening a DBF file. */
export interface OpenOptions {

    /**
     * The behavior to adopt when unsupported file versions or field types are encountered. The following values are
     * supported, with the default being 'strict':
     * - 'strict': when an unsupported file version or field type is encountered, stop reading the file immediately and
     *   issue a descriptive error.
     * - 'loose': ignore unrecognised file versions, unsupported field types, and missing memo files and attempt to
     *   continue reading the file. Any unsupported field types encountered will be present in field descriptors but
     *   missing from read records.
     */
    readMode?: 'strict' | 'loose'

    /** The character encoding(s) to use when reading the DBF file. Defaults to ISO-8859-1. */
    encoding?: Encoding;

    /** Indicates whether deleted records should be included in results when reading records. Defaults to false. */
    includeDeletedRecords?: boolean;
}




/** Options for creating a DBF file. */
export interface CreateOptions {

    /** The file version to create. Currently versions 0x03, 0x83, 0x8b and 0x30 are supported. Defaults to 0x03. */
    fileVersion?: FileVersion;

    /** The character encoding(s) to use when writing the DBF file. Defaults to ISO-8859-1. */
    encoding?: Encoding;
}




/**
 * Character encoding. Either a string, which applies to all fields, or an object whose keys are field names and
 * whose values are encodings. If given as an object, field keys are all optional, but a 'default' key is required.
 * Valid encodings may be found here: https://github.com/ashtuchkin/iconv-lite/wiki/Supported-Encodings
 */
export type Encoding = string | {default: string, [fieldName: string]: string};




/** Validates the given OpenOptions and substitutes defaults for missing properties. Returns a new options object. */
export function normaliseOpenOptions(options: OpenOptions | undefined): Required<OpenOptions> {

    // Validate `encoding`.
    let encoding = options?.encoding ?? 'ISO-8859-1';
    assertValidEncoding(encoding);

    // Validate `readMode`.
    let readMode = options?.readMode ?? 'strict';
    if (readMode !== 'strict' && readMode !== 'loose') {
        throw new Error(`Invalid read mode ${readMode}`);
    }

    // Validate `includeDeletedRecords`.
    let includeDeletedRecords = options?.includeDeletedRecords ?? false;
    if (typeof includeDeletedRecords !== 'boolean') {
        throw new Error(`Invalid value 'includeDeletedRecords' value ${includeDeletedRecords}`);
    }

    // Return a new normalised options object.
    return {encoding, readMode, includeDeletedRecords};
}




/** Validates the given CreateOptions and substitutes defaults for missing properties. Returns a new options object. */
export function normaliseCreateOptions(options: CreateOptions | undefined): Required<CreateOptions> {

    // Validate `fileVersion`.
    let fileVersion = options?.fileVersion ?? 0x03;
    if (!isValidFileVersion(fileVersion)) throw new Error(`Invalid file version ${fileVersion}`);

    // Validate `encoding`.
    let encoding = options?.encoding ?? 'ISO-8859-1';
    assertValidEncoding(encoding);

    // Return a new normalised options object.
    return {fileVersion, encoding};
}




// Helper function for validating encodings.
function assertValidEncoding(encoding: unknown): asserts encoding is Encoding {
    if (typeof encoding === 'string') {
        if (!encodingExists(encoding)) throw new Error(`Unsupported character encoding '${encoding}'`);
    }
    else if (typeof encoding === 'object' && encoding !== null) {
        let encodingObject = encoding as Record<string, string>;
        if (!encodingObject.default) throw new Error(`No default encoding specified`);
        for (let key of Object.keys(encodingObject)) {
            if (!encodingExists(encodingObject[key])) throw new Error(`Unsupported character encoding '${encoding}'`);
        }
    }
    else {
        throw new Error(`Invalid encoding value ${encoding}`);
    }
}
