# DBFFile

### Summary

Read and write .dbf (dBase III) files in Node.js:

- Supports `C` (string) , `N` (numeric) , `I` (integer) , `L` (logical) and `D` (date) field types
- Can open an existing .dbf file
  - Can access all field descriptors
  - Can access total record count
  - Can read records in arbitrary-sized batches
  - Supports very large files
- Can create a new .dbf file
  - Can use field descriptors from a hash of from another instance
- Can append records to an existing .dbf file
  - Supports very large files
- All operations are asyncronous and return a promise

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
    static open(path: string): Promise<DBFFile>;

    /** Creates a new DBF file with no records. */
    static create(path: string, fields: Field[]): Promise<DBFFile>;

    /** Full path to the DBF file. */
    path: string;

    /** Total number of records in the DBF file (NB: includes deleted records). */
    recordCount: number;

    /** Metadata for all fields defined in the DBF file. */
    fields: Array<{
        name: string;
        type: string;
        size: number;
        decs: number;
    }>;

    /** Appends the specified records to this DBF file. */
    appendRecords(records: object[]): Promise<DBFFile>;

    /** Reads a subset of records from this DBF file. */
    readRecords(maxCount?: number): Promise<object[]>;
}
```
