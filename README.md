# DBFFile

### Summary

Read and write .dbf (dBase III and Visual FoxPro) files in Node.js:

- Supported field types:
  - `C` (string)
  - `N` (numeric)
  - `F` (float)
  - `Y` (currency)
  - `I` (integer)
  - `L` (logical)
  - `D` (date)
  - `T` (datetime)
  - `B` (double)
  - `M` (memo) Note: memo support is experimental/partial, with the following limitations:
    - read-only (can't create/write DBF files with memo fields)
    - can only read dBase III (version 0x83), dBase IV (version 0x8b), and VFP9 (version 0x30)
- 'Loose' read mode - tries to read any kind of .dbf file without complaining. Unsupported field types are simply skipped.
- Can open an existing .dbf file
  - Can access all field descriptors
  - Can access total record count
  - Can access date of last update
  - Can read records using async iteration
  - Can read records in arbitrary-sized batches
  - Can include deleted records in results
  - Supports very large files
- Can create a new .dbf file
  - Can use field descriptors from a user-specified object of from another instance
- Can append records to an existing .dbf file
  - Supports very large files
- Can specify character encodings either per-file or per-field.
  - the default encoding is `'ISO-8859-1'` (also known as latin 1)
  - example per-file encoding: `DBFFile.open(<path>, {encoding: 'EUC-JP'})`
  - example per-field encoding: `DBFFile.open(<path>, {encoding: {default: 'latin1', FIELD_XYZ: 'EUC-JP'}})`
  - supported encodings are listed [here](https://github.com/ashtuchkin/iconv-lite/wiki/Supported-Encodings).
- All operations are asynchronous and return a promise

### Installation

`npm install dbffile` or `yarn add dbffile`

### Example: read all records in a .dbf file using for-await-of

```javascript
import {DBFFile} from 'dbffile';

async function iterativeRead() {
    let dbf = await DBFFile.open('<full path to .dbf file>');
    console.log(`DBF file contains ${dbf.recordCount} records.`);
    console.log(`Field names: ${dbf.fields.map(f => f.name).join(', ')}`);
    for await (const record of dbf) console.log(record);
}
```

### Example: reading a batch of records from a .dbf file

```javascript
import {DBFFile} from 'dbffile';

async function batchRead() {
    let dbf = await DBFFile.open('<full path to .dbf file>');
    console.log(`DBF file contains ${dbf.recordCount} records.`);
    console.log(`Field names: ${dbf.fields.map(f => f.name).join(', ')}`);
    let records = await dbf.readRecords(100); // batch-reads up to 100 records, returned as an array
    for (let record of records) console.log(record);
}
```

### Example: writing a .dbf file

```javascript
import {DBFFile} from 'dbffile';

async function batchWrite() {
    let fieldDescriptors = [
        { name: 'fname', type: 'C', size: 255 },
        { name: 'lname', type: 'C', size: 255 }
    ];

    let records = [
        { fname: 'Joe', lname: 'Bloggs' },
        { fname: 'Mary', lname: 'Smith' }
    ];

    let dbf = await DBFFile.create('<full path to .dbf file>', fieldDescriptors);
    console.log('DBF file created.');
    await dbf.appendRecords(records);
    console.log(`${records.length} records added.`);
}
```

### Loose Read Mode

Not all versions and variants of .dbf file are supported by this library. Normally, when an unsupported file version or
field type is encountered, an error is reported and reading halts immediately. This has been a problem for users who
just want to recover data from old .dbf files, and would rather not write a PR or wait for one that adds the missing
file/field support.

A more forgiving approach to reading .dbf files is now provided by passing the option `{readMode: 'loose'}` to the
`DBFFile.open(...)` function. In this mode, unrecognised file versions, unsupported field types, and missing memo files
are all tolerated. Unsupported/missing field types are still present in the `fields` field descriptors, but will be missing in
the record data returned by the `readRecords(...)` method.


### API

The module exports the `DBFFile` class, which has the following shape:

```typescript
/** Represents a DBF file. */
class DBFFile {

    /** Opens an existing DBF file. */
    static open(path: string, options?: OpenOptions): Promise<DBFFile>;

    /** Creates a new DBF file with no records. */
    static create(path: string, fields: FieldDescriptor[], options?: CreateOptions): Promise<DBFFile>;

    /** Full path to the DBF file. */
    path: string;

    /** Total number of records in the DBF file (NB: includes deleted records). */
    recordCount: number;

    /** Date of last update as recorded in the DBF file header. */
    dateOfLastUpdate: Date;

    /** Metadata for all fields defined in the DBF file. */
    fields: FieldDescriptor[];

    /** Reads a subset of records from this DBF file. The current read position is remembered between calls. */
    readRecords(maxCount?: number): Promise<object[]>;

    /** Appends the specified records to this DBF file. */
    appendRecords(records: object[]): Promise<DBFFile>;

    /** Iterates over each record in this DBF file. */
    [Symbol.asyncIterator](): AsyncGenerator<object>;
}

/** Metadata describing a single field in a DBF file. */
interface FieldDescriptor {

    /** The name of the field. Must be no longer than 10 characters. */
    name: string;

    /**
     * The single-letter code for the field type.
     * C=string, N=numeric, F=float, I=integer, L=logical, D=date, M=memo.
     */
    type: 'C' | 'N' | 'F' | 'Y' | 'L' | 'D' | 'I' | 'M' | 'T' | 'B';

    /** The size of the field in bytes. */
    size: number;

    /** The number of decimal places. Optional; only used for some field types. */
    decimalPlaces?: number;
}

/** Options that may be passed to `DBFFile.open`. */
interface OpenOptions {
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

    /**
     * Indicates whether deleted records should be included in results when reading records. Defaults to false.
     * Deleted records have the property `[DELETED]: true`, using the `DELETED` symbol exported from this library.
     */
    includeDeletedRecords?: boolean;
}

/** Options that may be passed to `DBFFile.create`. */
interface CreateOptions {

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
type Encoding = string | {default: string, [fieldName: string]: string};
```
