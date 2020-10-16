# DBFFile

### Summary

Read and write .dbf (dBase III and Visual FoxPro) files in Node.js:

- Supported field types:
  - `C` (string)
  - `N` (numeric)
  - `F` (float)
  - `I` (integer)
  - `L` (logical)
  - `D` (date)
  - `T` (datetime)
  - `B` (double)
  - `M` (memo) Note: memo support is experimental/partial, with the following limitations:
    - read-only (can't create/write DBF files with memo fields)
    - dBase III (version 0x83) and dBase IV (version 0x8b) `.dbt` memo files only
- Can open an existing .dbf file
  - Can access all field descriptors
  - Can access total record count
  - Can read records in arbitrary-sized batches
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

### Example: reading a .dbf file

```javascript
import {DBFFile} from 'dbffile';

async function testRead() {
    let dbf = await DBFFile.open('<full path to .dbf file>');
    console.log(`DBF file contains ${dbf.recordCount} records.`);
    console.log(`Field names: ${dbf.fields.map(f => f.name).join(', ')}`);
    let records = await dbf.readRecords(100);
    for (let record of records) console.log(records);
}
```

### Example: writing a .dbf file

```javascript
import {DBFFile} from 'dbffile';

async function testWrite() {
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

### API

The module exports the `DBFFile` class, which has the following shape:

```typescript
/** Represents a DBF file. */
class DBFFile {

    /** Opens an existing DBF file. */
    static async open(path: string, options?: Partial<Options>);

    /** Creates a new DBF file with no records. */
    static async create(path: string, fields: FieldDescriptor[], options?: Partial<Options>);

    /** Full path to the DBF file. */
    path: string;

    /** Total number of records in the DBF file (NB: includes deleted records). */
    recordCount: number;

    /** Metadata for all fields defined in the DBF file. */
    fields: FieldDescriptor[];

    /** Reads a subset of records from this DBF file. The current read position is remembered between calls. */
    readRecords(maxCount?: number): Promise<object[]>;

    /** Appends the specified records to this DBF file. */
    appendRecords(records: object[]): Promise<DBFFile>;
}


/** Metadata describing a single field in a DBF file. */
export interface FieldDescriptor {

    /** The name of the field. Must be no longer than 10 characters. */
    name: string;

    /**
     * The single-letter code for the field type.
     * C=string, N=numeric, F=float, I=integer, L=logical, D=date, M=memo.
     */
    type: 'C' | 'N' | 'F' | 'L' | 'D' | 'I' | 'M' | 'T' | 'B';

    /** The size of the field in bytes. */
    size: number;

    /** The number of decimal places. Optional; only used for some field types. */
    decimalPlaces?: number;
}

/**
 * Character encoding. Either a string, which applies to all fields, or an object whose keys are field names and
 * whose values are encodings. If given as an object, field keys are all optional, but a 'default' key is required.
 * Valid encodings may be found here: https://github.com/ashtuchkin/iconv-lite/wiki/Supported-Encodings
 */
type Encoding = string | {default: string, [fieldName: string]: string};

/** Options that may be passed to `DBFFile.open` and `DBFFile.create`. */
interface Options {

    /** The file version to open or create. Currently versions 0x03, 0x83 and 0x8b are supported. */
    fileVersion?: FileVersion;

    /** The character encoding(s) to use when reading/writing the DBF file. Defaults to ISO-8859-1. */
    encoding: Encoding;

    /** Do not fail if trying to parse or write a version that is not officially supported. (This may still fail on other things)  */
    allowUnkownVersion?: boolean;

    /** Do not fail if trying to parse or write un-supported field types. */
    allowUnkownFields?: boolean;
}
```
