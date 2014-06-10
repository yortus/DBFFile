var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var _ = require('lodash');
var moment = require('moment');
var async = require('asyncawait/async');
var await = require('asyncawait/await');

// Structural typing for DBF field metadata (can't use interface because that would need exporting).
var field;

/** Represents a DBF file. */
var DBFFile = (function () {
    function DBFFile() {
        /** Full path to the DBF file. */
        this.path = null;
        /** Total number of records in the DBF file. */
        this.recordCount = null;
        /** Metadata for all fields defined in the DBF file. */
        this.fields = null;
    }
    /** Append the specified records to this DBF file. */
    DBFFile.prototype.append = function (records) {
        return appendToDBF(this, records);
    };

    /** Read a subset of records from this DBF file */
    DBFFile.prototype.readRecords = function (maxRows) {
        if (typeof maxRows === "undefined") { maxRows = 10000000; }
        return readRecordsFromDBF(this, maxRows);
    };

    /** Close the file */
    DBFFile.prototype.close = function () {
        if (this._fd) {
            fs.closeSync(this._fd);
            this._fd = null;
        }
    };

    /** Open an existing DBF file. */
    DBFFile.open = function (path) {
        return openDBF(path);
    };

    /** Creates a new DBF file with no records. */
    DBFFile.create = function (path, fields) {
        return createDBF(path, fields);
    };
    return DBFFile;
})();

//-------------------- Private implementation starts here --------------------
var openDBF = async(function (path) {
    //debugger;
    // Open the file and create a buffer to read through.
    var fd = await(fs.openAsync(path, 'r'));
    var buffer = new Buffer(32);

    // Get the number of records.
    await(fs.readAsync(fd, buffer, 0, 32, 0));
    var recordCount = buffer.readInt32LE(4);

    // Parse all field descriptors.
    var fields = [];
    while (true) {
        await(fs.readAsync(fd, buffer, 0, 32, null));
        if (buffer.readUInt8(0) === 0x0D)
            break;
        var field = {
            name: buffer.toString('utf8', 0, 10).split('\0')[0],
            type: String.fromCharCode(buffer[0x0B]),
            size: buffer.readUInt8(0x10),
            decs: buffer.readUInt8(0x11)
        };
        fields.push(field);
    }

    //debugger;
    // Parse the header terminator
    await(fs.readAsync(fd, buffer, 0, 1, ((fields.length + 1) * 32)));

    // Return a new DBFFile instance.
    var result = new DBFFile();
    result.path = path;
    result.recordCount = recordCount;
    result.fields = fields;
    result._fd = fd;
    return result;
});

var createDBF = async(function (path, fields) {
    try  {
        // Validate the field metadata.
        validateFields(fields);

        // Create the file and create a buffer to write through.
        var fd = await(fs.openAsync(path, 'wx'));
        var buffer = new Buffer(32);

        // Write the header structure up to the field descriptors.
        buffer.writeUInt8(0x03, 0x00); // Version (set to dBase III)
        var now = new Date();
        buffer.writeUInt8(now.getFullYear() - 1900, 0x01); // YY (year minus 1900)
        buffer.writeUInt8(now.getMonth(), 0x02); // MM
        buffer.writeUInt8(now.getDate(), 0x03); // DD
        buffer.writeInt32LE(0, 0x04); // Number of records (set to zero)
        buffer.writeUInt16LE(33 + (fields.length * 32), 0x08); // Length of header structure
        buffer.writeUInt16LE(calcRecordLength(fields), 0x0A); // Length of each record
        buffer.writeUInt32LE(0, 0x0C); // Reserved/unused (set to zero)
        buffer.writeUInt32LE(0, 0x10); // Reserved/unused (set to zero)
        buffer.writeUInt32LE(0, 0x14); // Reserved/unused (set to zero)
        buffer.writeUInt32LE(0, 0x18); // Reserved/unused (set to zero)
        buffer.writeUInt32LE(0, 0x1C); // Reserved/unused (set to zero)
        await(fs.writeAsync(fd, buffer, 0, 32, 0));

        for (var i = 0; i < fields.length; ++i) {
            var name = fields[i].name, type = fields[i].type, size = fields[i].size, decs = fields[i].decs || 0;
            buffer.write(name, 0, name.length, 'utf8'); // Field name (up to 10 chars)
            for (var j = name.length; j < 11; ++j) {
                buffer.writeUInt8(0, j);
            }
            buffer.writeUInt8(type.charCodeAt(0), 0x0B); // Field type
            buffer.writeUInt32LE(0, 0x0C); // Field data address (set to zero)
            buffer.writeUInt8(size, 0x10); // Field length
            buffer.writeUInt8(decs, 0x11); // Decimal count
            buffer.writeUInt16LE(0, 0x12); // Reserved (set to zero)
            buffer.writeUInt8(0x01, 0x14); // Work area ID (always 01h)
            buffer.writeUInt16LE(0, 0x15); // Reserved (set to zero)
            buffer.writeUInt8(0, 0x17); // Flag for SET fields (set to zero)
            buffer.writeUInt32LE(0, 0x18); // Reserved (set to zero)
            buffer.writeUInt32LE(0, 0x1C); // Reserved (set to zero)
            buffer.writeUInt8(0, 0x1F); // Index field flag (set to zero)
            await(fs.writeAsync(fd, buffer, 0, 32, null));
        }

        // Write the header terminator and EOF marker.
        buffer.writeUInt8(0x0D, 0); // Header terminator
        buffer.writeUInt8(0x1A, 1); // EOF marker
        await(fs.writeAsync(fd, buffer, 0, 2, null));

        // Return a new DBFFile instance.
        var result = new DBFFile();
        result.path = path;
        result.recordCount = 0;
        result.fields = _.cloneDeep(fields);
        return result;
    } finally {
        // Close the file.
        if (fd)
            await(fs.closeAsync(fd));
    }
});

var appendToDBF = async(function (dbf, records) {
    try  {
        // Open the file and create a buffer to read and write through.
        var fd = await(fs.openAsync(dbf.path, 'r+'));
        var recordLength = calcRecordLength(dbf.fields);
        var buffer = new Buffer(recordLength + 4);

        // Compute the current EOF position.
        var headerLength = 33 + (dbf.fields.length * 32);
        var eofPos = headerLength + dbf.recordCount * recordLength;

        // Seek to the EOF position to begin writing.
        await(fs.readAsync(fd, buffer, 0, 1, eofPos - 1));

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
                if (value === null || typeof value === 'undefined')
                    value = '';
                switch (field.type) {
                    case 'C':
                        for (var k = 0; k < field.size; ++k) {
                            var byte = k < value.length ? value.charCodeAt(k) : 0x20;
                            buffer.writeUInt8(byte, offset++);
                        }
                        break;

                    case 'N':
                        value = value.toString();
                        value = value.slice(0, field.size);
                        while (value.length < field.size)
                            value = ' ' + value;
                        buffer.write(value, offset, field.size, 'utf8');
                        offset += field.size;
                        break;

                    case 'L':
                        buffer.writeUInt8(value ? 0x54 : 0x46, offset++);
                        break;

                    case 'D':
                        value = value ? moment(value).format('YYYYMMDD') : '        ';
                        buffer.write(value, offset, 8, 'utf8');
                        offset += 8;
                        break;

                    default:
                        throw new Error("Type '" + field.type + "' is not supported");
                }
            }
            await(fs.writeAsync(fd, buffer, 0, recordLength, null));
        }

        // Write a new EOF marker.
        buffer.writeUInt8(0x1A, 0);
        await(fs.writeAsync(fd, buffer, 0, 1, null));

        // Update the record count in the file and in the DBFFile instance.
        dbf.recordCount += records.length;
        buffer.writeInt32LE(dbf.recordCount, 0);
        await(fs.writeAsync(fd, buffer, 0, 4, 0x04));

        // Return the same DBFFile instance.
        return dbf;
    } finally {
        // Close the file.
        if (fd)
            await(fs.closeAsync(fd));
    }
});

function parseDbfField(value, field) {
    var typedvalue;
    if (value === null || typeof value === 'undefined')
        typedvalue = '';

    switch (field.type) {
        case 'C':
            typedvalue = value.trim();
            break;

        case 'N':
            typedvalue = parseFloat(value);
            break;

        case 'L':
            typedvalue = (value === 'T');

            break;

        case 'D':
            //todo
            typedvalue = (value.trim().length == 0) ? null : moment(value, "YYYYMMDD").toDate();
            break;

        default:
            throw new Error("Type '" + field.type + "' is not supported");
    }
    return typedvalue;
}

var readRecordsFromDBF = async(function (dbf, maxRows) {
    var starttime = new Date();
    var d = new Promise(function (resolve, reject) {
        var rowarray = [];

        // Create a buffer to read through.
        var recordLength = calcRecordLength(dbf.fields);
        var buffer = new Buffer(recordLength + 4);

        for (var i = 0; i <= maxRows; i++) {
            //console.log(i);
            await(fs.readAsync(dbf._fd, buffer, 0, recordLength, null));
            if (buffer[0] === 0x1a)
                break;

            var chunk = buffer;

            var row = {};
            var offset = 0;
            for (var j = 0; j < dbf.fields.length; ++j) {
                var field = dbf.fields[j];
                var value = chunk.toString().substring(offset + 1, offset + field.size + 1);

                //console.log(value);
                var typedvalue = parseDbfField(value, field);

                row[field.name] = typedvalue;

                offset += field.size;
            }

            //console.log('row='+JSON.stringify(row));
            //add the row to the array
            rowarray.push(row);

            //if we are processing a LARGE file, provide some console output occasionally
            if (rowarray.length % 100000 == 0)
                console.log(rowarray.length);
            //});
        }

        //console.log('after for');
        var endtime = new Date();
        var seconds = (endtime.getTime() - starttime.getTime()) / 1000;
        console.log('processed in: ' + seconds + 's');

        //console.log('rowarray=' + JSON.stringify(rowarray));
        resolve(rowarray);
    });
    return d;
});

function validateFields(fields) {
    if (fields.length > 2046)
        throw new Error('Too many fields (maximum is 2046)');
    for (var i = 0; i < fields.length; ++i) {
        var name = fields[i].name, type = fields[i].type, size = fields[i].size, decs = fields[i].decs;
        if (!_.isString(name))
            throw new Error('Name must be a string');
        if (!_.isString(type) || type.length !== 1)
            throw new Error('Type must be a single character');
        if (!_.isNumber(size))
            throw new Error('Size must be a number');
        if (decs && !_.isNumber(decs))
            throw new Error('Decs must be null, or a number');
        if (name.length < 1)
            throw new Error("Field name '" + name + "' is too short (minimum is 1 char)");
        if (name.length > 10)
            throw new Error("Field name '" + name + "' is too long (maximum is 10 chars)");
        if (['C', 'N', 'L', 'D'].indexOf(type) === -1)
            throw new Error("Type '" + type + "' is not supported");
        if (size < 1)
            throw new Error('Field size is too small (minimum is 1)');
        if (type === 'C' && size > 255)
            throw new Error('Field size is too large (maximum is 255)');
        if (type === 'N' && size > 20)
            throw new Error('Field size is too large (maximum is 20)');
        if (type === 'L' && size !== 1)
            throw new Error('Invalid field size (must be 1)');
        if (type === 'D' && size !== 8)
            throw new Error('Invalid field size (must be 8)');
        if (decs && decs > 15)
            throw new Error('Decimal count is too large (maximum is 15)');
    }
}

function validateRecord(fields, record) {
    for (var i = 0; i < fields.length; ++i) {
        var name = fields[i].name, type = fields[i].type;
        var value = record[name];

        // Always allow null values
        if (value === null || typeof value === 'undefined')
            continue;

        // Perform type-specific checks
        if (type === 'C') {
            if (!_.isString(value))
                throw new Error('Expected a string');
            if (value.length > 255)
                throw new Error('Text is too long (maximum length is 255 chars)');
        } else if (type === 'N') {
            if (!_.isNumber(value))
                throw new Error('Expected a number');
        } else if (type === 'D') {
            if (!_.isDate(value))
                throw new Error('Expected a date');
        }
    }
}

function calcRecordLength(fields) {
    var len = 1;
    for (var i = 0; i < fields.length; ++i)
        len += fields[i].size;
    return len;
}
module.exports = DBFFile;
//# sourceMappingURL=dbfFile.js.map
