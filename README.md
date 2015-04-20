# DBFFile

### Summary

Read and write .dbf (dBase III) files in Node.js:

- Supports `C` (string) , `N` (numeric) , `L` (logical) and `D` (date) field types
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

`npm install dbffile`

### Example: reading a .dbf file

```javascript
var DBFFile = require('dbffile');

DBFFile.open('[full path to .dbf file]')
.then(function (dbf) {
  console.log('DBF file contains ' + dbf.recordCount + ' rows.');
  console.log('Field names: ' + dbf.fields.map(function (f) { return f.name; }).join(', '));
  return dbf.readRecords(100);
})
.then(function (rows) {
  rows.forEach(function (row) {
    console.log(row);
  });
})
.catch(function (err) {
  console.log('An error occurred: ' + err);
});
```

### Example: writing a .dbf file

```javascript
var DBFFile = require('dbffile');

var fieldDescriptors = [
  { name: 'fname', type: 'C', size: 255 },
  { name: 'lname', type: 'C', size: 255 }
];

var rows = [
  { fname: 'Joe', lname: 'Bloggs' },
  { fname: 'Mary', lname: 'Smith' }
];

DBFFile.create('[full path to .dbf file]', fieldDescriptors)
.then(function (dbf) {
  console.log('DBF file created.');
  return dbf.append(rows);
})
.then(function () {
  console.log(rows.length + ' rows added.');
})
.catch(function (err) {
  console.log('An error occurred: ' + err);
});
```

### API

The module export is the `DBFFile` class constructor function, whose interface is as follows:

```typescript
class DBFFile {

  /** Full path to the DBF file. */
  path: string;

  /** Total number of records in the DBF file. */
  recordCount: number;

  /** Metadata for all fields defined in the DBF file. */
  fields: { name: string; type: string; size: number; decs: number; }[];

  /** Append the specified records to this DBF file. */
  append(records: any[]): Promise<DBFFile>;

  /** read some specific rows from the dbf file. **/
  readRecords(maxRows?: number): Promise<any[]>;

  /** Open an existing DBF file. */
  static open(path: string): Promise<DBFFile>;

  /** Creates a new DBF file with no records. */
  static create(path: string, fields: { name: string; type: string; size: number; decs: number; }[]): Promise<DBFFile>;
}
```


