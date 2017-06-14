import * as assert from 'assert';
import * as Bluebird from 'bluebird';
var fs: any = Bluebird.promisifyAll(require('fs'));
import * as _ from 'lodash';
import * as moment from 'moment';





// For information about the dBase III file format, see:
// http://www.dbf2002.com/dbf-file-format.html
// http://www.dbase.com/KnowledgeBase/int/db7_file_fmt.htm





/** Open an existing DBF file. */
export function open(path: string) {
    return openDBF(path);
}





/** Create a new DBF file with no records. */
export function create(path: string, fields: Field[]) {
    return createDBF(path, fields);
}





/** Represents a DBF file. */
export class DBFFile {


    /** Full path to the DBF file. */
    path: string = null;
    

    /** Total number of records in the DBF file. */
    recordCount: number = null;


    /** Metadata for all fields defined in the DBF file. */
    fields: Field[] = null;


    /** Append the specified records to this DBF file. */
    append(records: any[]) {
        return appendToDBF(this, records);
    }


    /** Read a subset of records from this DBF file. */
    readRecords(maxRows = 10000000) {
        return readRecordsFromDBF(this, maxRows);
    }
    

    // Private.
    _recordsRead: number;
    _headerLength: number;
    _recordLength: number;
}





/** Structural typing for DBF field metadata. */
export interface Field {
    name: string;
    type: string;
    size: number;
    decs: number;
}





//-------------------- Private implementation starts here --------------------
var openDBF = async (path: string): Promise<DBFFile> => {
    try {

        // Open the file and create a buffer to read through.
        var fd = await (fs.openAsync(path, 'r'));
        var buffer = new Buffer(32);

        // Read various properties from the header record.
        await (fs.readAsync(fd, buffer, 0, 32, 0));
        var fileVersion = buffer.readInt8(0);
        var recordCount = buffer.readInt32LE(4);
        var headerLength = buffer.readInt16LE(8);
        var recordLength = buffer.readInt16LE(10);

        // Ensure the file version is a supported one.
        assert(fileVersion === 0x03, `File '${path}' has unknown/unsupported dBase version: ${fileVersion}.`);

        // Parse all field descriptors.
        var fields: Field[] = [];
        while (headerLength > 32 + fields.length * 32) {
            await (fs.readAsync(fd, buffer, 0, 32, 32 + fields.length * 32));
            if (buffer.readUInt8(0) === 0x0D) break;
            var field = {
                name: buffer.toString('utf8', 0, 10).split('\0')[0],
                type: String.fromCharCode(buffer[0x0B]),
                size: buffer.readUInt8(0x10),
                decs: buffer.readUInt8(0x11)
            };
            assert(fields.every(f => f.name !== field.name), `Duplicate field name: '${field.name}'`);
            fields.push(field);
        }

        // Parse the header terminator.
        await (fs.readAsync(fd, buffer, 0, 1, 32 + fields.length * 32));
        assert(buffer[0] === 0x0d, 'Invalid DBF: Expected header terminator');

        // Validate the record length.
        assert(recordLength === calcRecordLength(fields), 'Invalid DBF: Incorrect record length');


        // Return a new DBFFile instance.
        var result = new DBFFile();
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
        if (fd) await (fs.closeAsync(fd));
    }
};





var createDBF = async (path: string, fields: Field[]): Promise<DBFFile> => {
    try {

        // Validate the field metadata.
        validateFields(fields);

        // Create the file and create a buffer to write through.
        var fd = await (fs.openAsync(path, 'wx'));
        var buffer = new Buffer(32);

        // Write the header structure up to the field descriptors.
        buffer.writeUInt8(0x03, 0x00);                          // Version (set to dBase III)
        var now = new Date();                                   // date of last update (YYMMDD)
        buffer.writeUInt8(now.getFullYear() - 1900, 0x01);      // YY (year minus 1900)
        buffer.writeUInt8(now.getMonth(), 0x02);                // MM
        buffer.writeUInt8(now.getDate(), 0x03);                 // DD
        buffer.writeInt32LE(0, 0x04);                           // Number of records (set to zero)
        var headerLength = 34 + (fields.length * 32);
        buffer.writeUInt16LE(headerLength, 0x08);               // Length of header structure
        var recordLength = calcRecordLength(fields)
        buffer.writeUInt16LE(recordLength, 0x0A);               // Length of each record
        buffer.writeUInt32LE(0, 0x0C);                          // Reserved/unused (set to zero)
        buffer.writeUInt32LE(0, 0x10);                          // Reserved/unused (set to zero)
        buffer.writeUInt32LE(0, 0x14);                          // Reserved/unused (set to zero)
        buffer.writeUInt32LE(0, 0x18);                          // Reserved/unused (set to zero)
        buffer.writeUInt32LE(0, 0x1C);                          // Reserved/unused (set to zero)
        await (fs.writeAsync(fd, buffer, 0, 32, 0));

        // Write the field descriptors.
        for (var i = 0; i < fields.length; ++i) {
            var name = fields[i].name, type = fields[i].type, size = fields[i].size, decs = fields[i].decs || 0;
            buffer.write(name, 0, name.length, 'utf8');         // Field name (up to 10 chars)
            for (var j = name.length; j < 11; ++j) {            // null terminator(s)
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
            await (fs.writeAsync(fd, buffer, 0, 32, 32 + i * 32));
        }

        // Write the header terminator and EOF marker.
        buffer.writeUInt8(0x0D, 0);                             // Header terminator
        buffer.writeUInt8(0x00, 1);                             // Null byte (unnecessary but common, accounted for in header length)
        buffer.writeUInt8(0x1A, 2);                             // EOF marker
        await (fs.writeAsync(fd, buffer, 0, 3, 32 + fields.length * 32));

        // Return a new DBFFile instance.
        var result = new DBFFile();
        result.path = path;
        result.recordCount = 0;
        result.fields = _.cloneDeep(fields);
        result._recordsRead = 0;
        result._headerLength = headerLength;
        result._recordLength = recordLength;
        return result;
    }
    finally {

        // Close the file.
        if (fd) await (fs.closeAsync(fd));
    }
};





var appendToDBF = async (dbf: DBFFile, records: any[]): Promise<DBFFile> => {
    try {

        // Open the file and create a buffer to read and write through.
        var fd = await (fs.openAsync(dbf.path, 'r+'));
        var recordLength = calcRecordLength(dbf.fields);
        var buffer = new Buffer(recordLength + 4);

        // Calculate the file position at which to start appending.
        var currentPosition = dbf._headerLength + dbf.recordCount * recordLength;

        // Write the records.
        for (var i = 0; i < records.length; ++i) {

            // Write one record.
            var record = records[i];
            validateRecord(dbf.fields, record);
            var offset = 0;
            buffer.writeUInt8(0x20, offset++); // Record deleted flag

            // Write each field in the record.
            for (var j = 0; j < dbf.fields.length; ++j) {

                // Get the field's value.
                var field = dbf.fields[j];
                var value = records[i][field.name];
                if (value === null || typeof value === 'undefined') value = '';

                // Use raw data if provided in the record.
                var raw = records[i]._raw && records[i]._raw[field.name];
                if (raw && Buffer.isBuffer(raw) && raw.length === field.size) {
                    raw.copy(buffer, offset);
                    offset += field.size;
                    continue;
                }

                // Encode the field in the buffer, according to its type.
                switch (field.type) {

                    case 'C': // Text
                        for (var k = 0; k < field.size; ++k) {
                            //TEMP testing... treat string as octets, not utf8/ascii
                            //var byte = k < value.length ? value[k] : 0x20;
                            var byte = k < value.length ? value.charCodeAt(k) : 0x20;
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
                        value = value ? moment(value).format('YYYYMMDD') : '        ';
                        buffer.write(value, offset, 8, 'utf8');
                        offset += 8;
                        break;

                    default:
                        throw new Error("Type '" + field.type + "' is not supported");
                }
            }
            await (fs.writeAsync(fd, buffer, 0, recordLength, currentPosition));
            currentPosition += recordLength;
        }

        // Write a new EOF marker.
        buffer.writeUInt8(0x1A, 0);
        await (fs.writeAsync(fd, buffer, 0, 1, currentPosition));

        // Update the record count in the file and in the DBFFile instance.
        dbf.recordCount += records.length;
        buffer.writeInt32LE(dbf.recordCount, 0);
        await (fs.writeAsync(fd, buffer, 0, 4, 0x04));

        // Return the same DBFFile instance.
        return dbf;
    }
    finally {

        // Close the file.
        if (fd) await (fs.closeAsync(fd));
    }
};





var readRecordsFromDBF = async (dbf: DBFFile, maxRows: number) => {
    try {

        // Open the file and prepare to create a buffer to read through.
        var fd = await (fs.openAsync(dbf.path, 'r'));
        var rowsInBuffer = 1000;
        var recordLength = dbf._recordLength;
        var buffer = new Buffer(recordLength * rowsInBuffer);

        // Calculate the file position at which to start reading.
        var currentPosition = dbf._headerLength + recordLength * dbf._recordsRead;

        // Create a convenience function for extracting strings from the buffer.
        var substr = (start, count) => buffer.toString('utf8', start, start + count);

        // Read rows in chunks, until enough rows have been read.
        var rows = [];
        while (true) {

            // Work out how many rows to read in this chunk.
            var maxRows1 = dbf.recordCount - dbf._recordsRead;
            var maxRows2 = maxRows - rows.length;
            var rowsToRead = maxRows1 < maxRows2 ? maxRows1 : maxRows2;
            if (rowsToRead > rowsInBuffer) rowsToRead = rowsInBuffer;

            // Quit when no more rows to read.
            if (rowsToRead === 0) break;

            // Read the chunk of rows into the buffer.
            await (fs.readAsync(fd, buffer, 0, recordLength * rowsToRead, currentPosition));
            dbf._recordsRead += rowsToRead;
            currentPosition += recordLength * rowsToRead;

            // Parse each row.
            for (var i = 0, offset = 0; i < rowsToRead; ++i) {
                var row = { _raw: {} };
                var isDeleted = (buffer[offset++] === 0x2a);
                if (isDeleted) { offset += recordLength - 1; continue; }

                // Parse each field.
                for (var j = 0; j < dbf.fields.length; ++j) {
                    var field = dbf.fields[j];
                    var len = field.size, value: any = null;

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
                            var c = String.fromCharCode(buffer[offset++]);
                            value = 'TtYy'.indexOf(c) >= 0 ? true : ('FfNn'.indexOf(c) >= 0 ? false : null);
                            break;
                        case 'D': // Date
                            value = buffer[offset] === 0x20 ? null : moment(substr(offset, 8), "YYYYMMDD").toDate();
                            offset += 8;
                            break;
                        default:
                            throw new Error("Type '" + field.type + "' is not supported");
                    }
                    row[field.name] = value;
                }

                //add the row to the result.
                rows.push(row);
            }

            // Allocate a new buffer, so that all the raw buffer slices created above arent't invalidated.
            buffer = new Buffer(recordLength * rowsInBuffer);
        }

        // Return all the rows that were read.
        return rows;
    }
    finally {

        // Close the file.
        if (fd) await (fs.closeAsync(fd));
    }
};





function validateFields(fields: Field[]): void {
    if (fields.length > 2046) throw new Error('Too many fields (maximum is 2046)');
    for (var i = 0; i < fields.length; ++i) {
        var name = fields[i].name, type = fields[i].type, size = fields[i].size, decs = fields[i].decs;
        if (!_.isString(name)) throw new Error('Name must be a string');
        if (!_.isString(type) || type.length !== 1) throw new Error('Type must be a single character');
        if (!_.isNumber(size)) throw new Error('Size must be a number');
        if (decs && !_.isNumber(decs)) throw new Error('Decs must be null, or a number');
        if (name.length < 1) throw new Error("Field name '" + name + "' is too short (minimum is 1 char)");
        if (name.length > 10) throw new Error("Field name '" + name + "' is too long (maximum is 10 chars)");
        if (['C', 'N', 'L', 'D'].indexOf(type) === -1) throw new Error("Type '" + type + "' is not supported");
        if (size < 1) throw new Error('Field size is too small (minimum is 1)');
        if (type === 'C' && size > 255) throw new Error('Field size is too large (maximum is 255)');
        if (type === 'N' && size > 20) throw new Error('Field size is too large (maximum is 20)');
        if (type === 'L' && size !== 1) throw new Error('Invalid field size (must be 1)');
        if (type === 'D' && size !== 8) throw new Error('Invalid field size (must be 8)');
        if (decs && decs > 15) throw new Error('Decimal count is too large (maximum is 15)');
    }
}





function validateRecord(fields: Field[], record: {}): void {
    for (var i = 0; i < fields.length; ++i) {
        var name = fields[i].name, type = fields[i].type;
        var value = record[name];

        // Always allow null values
        if (value === null || typeof value === 'undefined') continue;

        // Perform type-specific checks
        if (type === 'C') {
            if (!_.isString(value)) throw new Error('Expected a string');
            if (value.length > 255) throw new Error('Text is too long (maximum length is 255 chars)');
        }
        else if (type === 'N') {
            if (!_.isNumber(value)) throw new Error('Expected a number');
        }
        else if (type === 'D') {
            if (!_.isDate(value)) throw new Error('Expected a date');
        }
    }
}





function calcRecordLength(fields: Field[]): number {
    var len = 1; // 'Record deleted flag' adds one byte
    for (var i = 0; i < fields.length; ++i) len += fields[i].size;
    return len;
}
