import _refs = require('_refs');
import Promise = require('bluebird');
var fs: any = Promise.promisifyAll(require('fs'));
import _ = require('lodash');
import moment = require('moment');
import async = require('asyncawait/async');
import await = require('asyncawait/await');
export = DBFFile;


// Structural typing for DBF field metadata (can't use interface because that would need exporting).
var field: { name: string; type: string; size: number; decs: number; };


/** Represents a DBF file. */
class DBFFile {

    /** Full path to the DBF file. */
    path: string = null;

    /** Total number of records in the DBF file. */
    recordCount: number = null;

    /** Metadata for all fields defined in the DBF file. */
    fields: typeof field[] = null;

    /** Append the specified records to this DBF file. */
    append(records: any[]) {
        return appendToDBF(this, records);
    }

    /** Open an existing DBF file. */
    static open(path: string) {
        return openDBF(path);
    }

    /** Creates a new DBF file with no records. */
    static create(path: string, fields: typeof field[]) {
        return createDBF(path, fields);
    }
}


//-------------------- Private implementation starts here --------------------
var openDBF = async ((path: string): DBFFile => {
    try {

        // Open the file and create a buffer to read through.
        var fd = await (fs.openAsync(path, 'r'));
        var buffer = new Buffer(32);

        // Get the number of records.
        await (fs.readAsync(fd, buffer, 0, 32, 0));
        var recordCount = buffer.readInt32LE(4);

        // Parse all field descriptors.
        var fields = [];
        while (true) {
            await (fs.readAsync(fd, buffer, 0, 32, null));
            if (buffer.readUInt8(0) === 0x0D) break;
            var field = {
                name: buffer.toString('utf8', 0, 10).split('\0')[0],
                type: String.fromCharCode(buffer[0x0B]),
                size: buffer.readUInt8(0x10),
                decs: buffer.readUInt8(0x11)
            };
            fields.push(field);
        }

        // Return a new DBFFile instance.
        var result = new DBFFile();
        result.path = path;
        result.recordCount = recordCount;
        result.fields = fields;
        return result;
    }
    finally {

        // Close the file.
        if (fd) await (fs.closeAsync(fd));
    }
});


var createDBF = async ((path: string, fields: typeof field[]): DBFFile => {
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
        buffer.writeUInt16LE(33 + (fields.length * 32), 0x08);  // Length of header structure
        buffer.writeUInt16LE(calcRecordLength(fields), 0x0A);   // Length of each record
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
            buffer.writeUInt8(0x01, 0x14);                      // Work area ID (always 01h)
            buffer.writeUInt16LE(0, 0x15);                      // Reserved (set to zero)
            buffer.writeUInt8(0, 0x17);                         // Flag for SET fields (set to zero)
            buffer.writeUInt32LE(0, 0x18);                      // Reserved (set to zero)
            buffer.writeUInt32LE(0, 0x1C);                      // Reserved (set to zero)
            buffer.writeUInt8(0, 0x1F);                         // Index field flag (set to zero)
            await (fs.writeAsync(fd, buffer, 0, 32, null));
        }

        // Write the header terminator and EOF marker.
        buffer.writeUInt8(0x0D, 0);                             // Header terminator
        buffer.writeUInt8(0x1A, 1);                             // EOF marker
        await (fs.writeAsync(fd, buffer, 0, 2, null));

        // Return a new DBFFile instance.
        var result = new DBFFile();
        result.path = path;
        result.recordCount = 0;
        result.fields = _.cloneDeep(fields);
        return result;
    }
    finally {

        // Close the file.
        if (fd) await (fs.closeAsync(fd));
    }
});


var appendToDBF = async ((dbf: DBFFile, records: any[]) => {
    try {

        // Open the file and create a buffer to read and write through.
        var fd = await (fs.openAsync(dbf.path, 'r+'));
        var recordLength = calcRecordLength(dbf.fields);
        var buffer = new Buffer(recordLength + 4);

        // Compute the current EOF position.
        var headerLength = 33 + (dbf.fields.length * 32);
        var eofPos = headerLength + dbf.recordCount * recordLength;

        // Seek to the EOF position to begin writing.
        await (fs.readAsync(fd, buffer, 0, 1, eofPos - 1));

        // Write the records.
        for (var i = 0; i < records.length; ++i) {

            // Write one record.
            var record = records[i];
            validateRecord(dbf.fields, record);
            var offset = 0;
            buffer.writeUInt8(0x20, offset++); // Record deleted flag
            for (var j = 0; j < dbf.fields.length; ++j) {

                // Write one field, according to its type.
                var field = dbf.fields[j];
                var value = records[i][field.name];
                if (value === null || typeof value === 'undefined') value = '';
                switch (field.type) {

                    case 'C': // Text
                        for (var k = 0; k < field.size; ++k) {
                            var byte = k < value.length ? value.charCodeAt(k) : 0x20;
                            buffer.writeUInt8(byte, offset++);
                        }
                        break;

                    case 'N': // Number
                        value = value.toString();
                        value = value.slice(0, field.size);
                        while (value.length < field.size) value  = ' ' + value;
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
            await (fs.writeAsync(fd, buffer, 0, recordLength, null));
        }

        // Write a new EOF marker.
        buffer.writeUInt8(0x1A, 0);
        await (fs.writeAsync(fd, buffer, 0, 1, null));

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
});


function validateFields(fields: typeof field[]): void {
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


function validateRecord(fields: typeof field[], record: {}): void {
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


function calcRecordLength(fields: typeof field[]): number {
    var len = 1; // 'Record deleted flag' adds one byte
    for (var i = 0; i < fields.length; ++i) len += fields[i].size;
    return len;
}
