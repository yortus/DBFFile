// For information about the dBase III file format, see:
// https://en.wikipedia.org/wiki/.dbf
// http://www.dbf2002.com/dbf-file-format.html
// http://www.dbase.com/KnowledgeBase/int/db7_file_fmt.htm




import * as assert from 'assert';
import {formatDate, parseDate} from './date';
import * as fs from './fs';




/** Represents a DBF file. */
export class DBFFile {

    /** Opens an existing DBF file. */
    static async open(path: string) {
        return openDBF(path);
    }

    /** Creates a new DBF file with no records. */
    static async create(path: string, fields: Field[]) {
        return createDBF(path, fields);
    }

    /** Full path to the DBF file. */
    path = '';

    /** Total number of records in the DBF file. */
    recordCount = 0;

    /** Metadata for all fields defined in the DBF file. */
    fields = [] as Field[];

    /** Appends the specified records to this DBF file. */
    append(records: any[]) {
        return appendToDBF(this, records);
    }

    /** Reads a subset of records from this DBF file. */
    readRecords(maxRows = 10000000) {
        return readRecordsFromDBF(this, maxRows);
    }

    // Private.
    _recordsRead = 0;
    _headerLength = 0;
    _recordLength = 0;
}




/** Metadata describing a single field in a DBF file. */
export interface Field {
    name: string;
    type: string;
    size: number;
    decs: number;
}




//-------------------- Private implementation starts here --------------------
async function openDBF(path: string): Promise<DBFFile> {
    let fd = 0;
    try {
        // Open the file and create a buffer to read through.
        fd = await fs.open(path, 'r');
        let buffer = Buffer.alloc(32);

        // Read various properties from the header record.
        await fs.read(fd, buffer, 0, 32, 0);
        let fileVersion = buffer.readInt8(0);
        let recordCount = buffer.readInt32LE(4);
        let headerLength = buffer.readInt16LE(8);
        let recordLength = buffer.readInt16LE(10);

        // Ensure the file version is a supported one.
        assert(fileVersion === 0x03, `File '${path}' has unknown/unsupported dBase version: ${fileVersion}.`);

        // Parse all field descriptors.
        let fields: Field[] = [];
        while (headerLength > 32 + fields.length * 32) {
            await fs.read(fd, buffer, 0, 32, 32 + fields.length * 32);
            if (buffer.readUInt8(0) === 0x0D) break;
            let field = {
                name: buffer.toString('utf8', 0, 10).split('\0')[0],
                type: String.fromCharCode(buffer[0x0B]),
                size: buffer.readUInt8(0x10),
                decs: buffer.readUInt8(0x11)
            };
            assert(fields.every(f => f.name !== field.name), `Duplicate field name: '${field.name}'`);
            fields.push(field);
        }

        // Parse the header terminator.
        await fs.read(fd, buffer, 0, 1, 32 + fields.length * 32);
        assert(buffer[0] === 0x0d, 'Invalid DBF: Expected header terminator');

        // Validate the record length.
        assert(recordLength === calcRecordLength(fields), 'Invalid DBF: Incorrect record length');


        // Return a new DBFFile instance.
        let result = new DBFFile();
        result.path = path;
        result.recordCount = recordCount;
        result.fields = fields;
        result._recordsRead = 0;
        result._headerLength = headerLength;
        result._recordLength = recordLength;
        return result;
    }
    finally {
        // Close the file.
        if (fd) await fs.close(fd);
    }
};




async function createDBF(path: string, fields: Field[]): Promise<DBFFile> {
    let fd = 0;
    try {
        // Validate the field metadata.
        validateFields(fields);

        // Create the file and create a buffer to write through.
        fd = await fs.open(path, 'wx');
        let buffer = Buffer.alloc(32);

        // Write the header structure up to the field descriptors.
        buffer.writeUInt8(0x03, 0x00);                          // Version (set to dBase III)
        let now = new Date();                                   // date of last update (YYMMDD)
        buffer.writeUInt8(now.getFullYear() - 1900, 0x01);      // YY (year minus 1900)
        buffer.writeUInt8(now.getMonth(), 0x02);                // MM
        buffer.writeUInt8(now.getDate(), 0x03);                 // DD
        buffer.writeInt32LE(0, 0x04);                           // Number of records (set to zero)
        let headerLength = 34 + (fields.length * 32);
        buffer.writeUInt16LE(headerLength, 0x08);               // Length of header structure
        let recordLength = calcRecordLength(fields)
        buffer.writeUInt16LE(recordLength, 0x0A);               // Length of each record
        buffer.writeUInt32LE(0, 0x0C);                          // Reserved/unused (set to zero)
        buffer.writeUInt32LE(0, 0x10);                          // Reserved/unused (set to zero)
        buffer.writeUInt32LE(0, 0x14);                          // Reserved/unused (set to zero)
        buffer.writeUInt32LE(0, 0x18);                          // Reserved/unused (set to zero)
        buffer.writeUInt32LE(0, 0x1C);                          // Reserved/unused (set to zero)
        await fs.write(fd, buffer, 0, 32, 0);

        // Write the field descriptors.
        for (let i = 0; i < fields.length; ++i) {
            let name = fields[i].name, type = fields[i].type, size = fields[i].size, decs = fields[i].decs || 0;
            buffer.write(name, 0, name.length, 'utf8');         // Field name (up to 10 chars)
            for (let j = name.length; j < 11; ++j) {            // null terminator(s)
                buffer.writeUInt8(0, j);
            }
            buffer.writeUInt8(type.charCodeAt(0), 0x0B);        // Field type
            buffer.writeUInt32LE(0, 0x0C);                      // Field data address (set to zero)
            buffer.writeUInt8(size, 0x10);                      // Field length
            buffer.writeUInt8(decs, 0x11);                      // Decimal count
            buffer.writeUInt16LE(0, 0x12);                      // Reserved (set to zero)
            buffer.writeUInt8(0x01, 0x14);                      // Work area ID (always 01h for dBase III)
            buffer.writeUInt16LE(0, 0x15);                      // Reserved (set to zero)
            buffer.writeUInt8(0, 0x17);                         // Flag for SET fields (set to zero)
            buffer.writeUInt32LE(0, 0x18);                      // Reserved (set to zero)
            buffer.writeUInt32LE(0, 0x1C);                      // Reserved (set to zero)
            buffer.writeUInt8(0, 0x1F);                         // Index field flag (set to zero)
            await fs.write(fd, buffer, 0, 32, 32 + i * 32);
        }

        // Write the header terminator and EOF marker.
        buffer.writeUInt8(0x0D, 0);                             // Header terminator
        buffer.writeUInt8(0x00, 1);                             // Null byte (unnecessary but common, accounted for in header length)
        buffer.writeUInt8(0x1A, 2);                             // EOF marker
        await fs.write(fd, buffer, 0, 3, 32 + fields.length * 32);

        // Return a new DBFFile instance.
        let result = new DBFFile();
        result.path = path;
        result.recordCount = 0;
        result.fields = fields.map(field => ({...field})); // make new copy of field descriptors
        result._recordsRead = 0;
        result._headerLength = headerLength;
        result._recordLength = recordLength;
        return result;
    }
    finally {
        // Close the file.
        if (fd) await fs.close(fd);
    }
};




async function appendToDBF(dbf: DBFFile, records: any[]): Promise<DBFFile> {
    let fd = 0;
    try {
        // Open the file and create a buffer to read and write through.
        fd = await fs.open(dbf.path, 'r+');
        let recordLength = calcRecordLength(dbf.fields);
        let buffer = Buffer.alloc(recordLength + 4);

        // Calculate the file position at which to start appending.
        let currentPosition = dbf._headerLength + dbf.recordCount * recordLength;

        // Write the records.
        for (let i = 0; i < records.length; ++i) {

            // Write one record.
            let record = records[i];
            validateRecord(dbf.fields, record);
            let offset = 0;
            buffer.writeUInt8(0x20, offset++); // Record deleted flag

            // Write each field in the record.
            for (let j = 0; j < dbf.fields.length; ++j) {

                // Get the field's value.
                let field = dbf.fields[j];
                let value = records[i][field.name];
                if (value === null || typeof value === 'undefined') value = '';

                // Use raw data if provided in the record.
                let raw = records[i]._raw && records[i]._raw[field.name];
                if (raw && Buffer.isBuffer(raw) && raw.length === field.size) {
                    raw.copy(buffer, offset);
                    offset += field.size;
                    continue;
                }

                // Encode the field in the buffer, according to its type.
                switch (field.type) {

                    case 'C': // Text
                        for (let k = 0; k < field.size; ++k) {
                            //TEMP testing... treat string as octets, not utf8/ascii
                            //let byte = k < value.length ? value[k] : 0x20;
                            let byte = k < value.length ? value.charCodeAt(k) : 0x20;
                            buffer.writeUInt8(byte, offset++);
                        }
                        break;

                    case 'N': // Number
                        value = value.toString();
                        value = value.slice(0, field.size);
                        while (value.length < field.size) value = ' ' + value;
                        buffer.write(value, offset, field.size, 'utf8');
                        offset += field.size;
                        break;

                    case 'L': // Boolean
                        buffer.writeUInt8(value ? 0x54/* 'T' */ : 0x46/* 'F' */, offset++);
                        break;

                    case 'D': // Date
                        value = value ? formatDate(value) : '        ';
                        buffer.write(value, offset, 8, 'utf8');
                        offset += 8;
                        break;

                    case 'I': // Integer
                        buffer.writeInt32LE(value, offset);
                        offset += field.size;
                        break;

                    default:
                        throw new Error(`Type '${field.type}' is not supported`);
                }
            }
            await fs.write(fd, buffer, 0, recordLength, currentPosition);
            currentPosition += recordLength;
        }

        // Write a new EOF marker.
        buffer.writeUInt8(0x1A, 0);
        await fs.write(fd, buffer, 0, 1, currentPosition);

        // Update the record count in the file and in the DBFFile instance.
        dbf.recordCount += records.length;
        buffer.writeInt32LE(dbf.recordCount, 0);
        await fs.write(fd, buffer, 0, 4, 0x04);

        // Return the same DBFFile instance.
        return dbf;
    }
    finally {
        // Close the file.
        if (fd) await fs.close(fd);
    }
};




async function readRecordsFromDBF(dbf: DBFFile, maxRows: number) {
    let fd = 0;
    try {
        // Open the file and prepare to create a buffer to read through.
        fd = await fs.open(dbf.path, 'r');
        let rowsInBuffer = 1000;
        let recordLength = dbf._recordLength;
        let buffer = Buffer.alloc(recordLength * rowsInBuffer);

        // Calculate the file position at which to start reading.
        let currentPosition = dbf._headerLength + recordLength * dbf._recordsRead;

        // Create a convenience function for extracting strings from the buffer.
        let substr = (start: number, count: number) => buffer.toString('utf8', start, start + count);

        // Read rows in chunks, until enough rows have been read.
        let rows = [];
        while (true) {

            // Work out how many rows to read in this chunk.
            let maxRows1 = dbf.recordCount - dbf._recordsRead;
            let maxRows2 = maxRows - rows.length;
            let rowsToRead = maxRows1 < maxRows2 ? maxRows1 : maxRows2;
            if (rowsToRead > rowsInBuffer) rowsToRead = rowsInBuffer;

            // Quit when no more rows to read.
            if (rowsToRead === 0) break;

            // Read the chunk of rows into the buffer.
            await fs.read(fd, buffer, 0, recordLength * rowsToRead, currentPosition);
            dbf._recordsRead += rowsToRead;
            currentPosition += recordLength * rowsToRead;

            // Parse each row.
            for (let i = 0, offset = 0; i < rowsToRead; ++i) {
                let row = {_raw: {}} as Record<string, unknown> & { _raw: Record<string, unknown> };
                let isDeleted = (buffer[offset++] === 0x2a);
                if (isDeleted) { offset += recordLength - 1; continue; }

                // Parse each field.
                for (let j = 0; j < dbf.fields.length; ++j) {
                    let field = dbf.fields[j];
                    let len = field.size, value: any = null;

                    // Keep raw buffer data for each field value.
                    row._raw[field.name] = buffer.slice(offset, offset + field.size);

                    // Decode the field from the buffer, according to its type.
                    switch (field.type) {
                        case 'C': // Text
                            while (len > 0 && buffer[offset + len - 1] === 0x20) --len;
                            value = substr(offset, len);
                            offset += field.size;
                            break;
                        case 'N': // Number
                            while (len > 0 && buffer[offset] === 0x20) ++offset, --len;
                            value = len > 0 ? parseFloat(substr(offset, len)) : null;
                            offset += len;
                            break;
                        case 'L': // Boolean
                        let c = String.fromCharCode(buffer[offset++]);
                            value = 'TtYy'.indexOf(c) >= 0 ? true : ('FfNn'.indexOf(c) >= 0 ? false : null);
                            break;
                        case 'D': // Date
                            value = buffer[offset] === 0x20 ? null : parseDate(substr(offset, 8));
                            offset += 8;
                            break;
                        case 'I': // Integer
                            value = buffer.readInt32LE(offset);
                            offset += field.size;
                            break;
                        default:
                            throw new Error(`Type '${field.type}' is not supported`);
                    }
                    row[field.name] = value;
                }

                //add the row to the result.
                rows.push(row);
            }

            // Allocate a new buffer, so that all the raw buffer slices created above arent't invalidated.
            buffer = Buffer.alloc(recordLength * rowsInBuffer);
        }

        // Return all the rows that were read.
        return rows;
    }
    finally {
        // Close the file.
        if (fd) await fs.close(fd);
    }
};




function validateFields(fields: Field[]): void {
    if (fields.length > 2046) throw new Error('Too many fields (maximum is 2046)');
    for (let i = 0; i < fields.length; ++i) {
        let name = fields[i].name, type = fields[i].type, size = fields[i].size, decs = fields[i].decs;
        if (typeof name !== 'string') throw new Error('Name must be a string');
        if (typeof type !== 'string' || type.length !== 1) throw new Error('Type must be a single character');
        if (typeof size !== 'number') throw new Error('Size must be a number');
        if (decs !== null && typeof decs !== 'number') throw new Error('Decs must be null, or a number');
        if (name.length < 1) throw new Error(`Field name '${name}' is too short (minimum is 1 char)`);
        if (name.length > 10) throw new Error(`Field name '${name}' is too long (maximum is 10 chars)`);
        if (['C', 'N', 'L', 'D', 'I'].indexOf(type) === -1) throw new Error(`Type '${type}' is not supported`);
        if (size < 1) throw new Error('Field size is too small (minimum is 1)');
        if (type === 'C' && size > 255) throw new Error('Field size is too large (maximum is 255)');
        if (type === 'N' && size > 20) throw new Error('Field size is too large (maximum is 20)');
        if (type === 'L' && size !== 1) throw new Error('Invalid field size (must be 1)');
        if (type === 'D' && size !== 8) throw new Error('Invalid field size (must be 8)');
        if (type === 'I' && size !== 4) throw new Error('Invalid field size (must be 4)');
        if (decs && decs > 15) throw new Error('Decimal count is too large (maximum is 15)');
    }
}




function validateRecord(fields: Field[], record: Record<string, unknown>): void {
    for (let i = 0; i < fields.length; ++i) {
        let name = fields[i].name, type = fields[i].type;
        let value = record[name];

        // Always allow null values
        if (value === null || typeof value === 'undefined') continue;

        // Perform type-specific checks
        if (type === 'C') {
            if (typeof value !== 'string') throw new Error('Expected a string');
            if (value.length > 255) throw new Error('Text is too long (maximum length is 255 chars)');
        }
        else if (type === 'N') {
            if (typeof value !== 'number') throw new Error('Expected a number');
        }
        else if (type === 'D') {
            if (!(value instanceof Date)) throw new Error('Expected a date');
        }
    }
}




function calcRecordLength(fields: Field[]): number {
    let len = 1; // 'Record deleted flag' adds one byte
    for (let i = 0; i < fields.length; ++i) len += fields[i].size;
    return len;
}
