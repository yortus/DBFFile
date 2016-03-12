var _ = require('lodash');
var moment = require('moment');

const bluebird = require('bluebird');
const fs = bluebird.promisifyAll(require('fs'));
const assert = require('assert');
const p = require('path');
const FPTMemoFile = require('./FPTMemoFile.js');

require('babel-polyfill');

// Structural typing for DBF field metadata (can't use interface because that would need exporting).
var field;

const supportedFileVersions = [
    0x03, // FoxBASE+/FoxPro/Dbase III plus, no memo
    0xF5  // FoxPro 2.x (or earlier) with memo
];

class DBFFile
{
    constructor() {
        this.path = null;
        this.recordCount = null;
        this.fields = null;
        this.charset = 'ascii';
        this.memoFilePath;
        this.fields = [];
        this.fd;
        this.fileVersion;
        
        this._headerLength;
        this._recordLength;
        this._recordsRead = 0
    }
    
    async open(path, options) {
        
        var defaults = {
            memoFile: false,
            charset: 'utf8'
        };
        options = options || defaults;

        if (options.charset !== undefined) {
            this.charset = options.charset;
        }
        if (options.memoFilePath !== undefined) {
            this.memoFilePath = options.memoFilePath;

            await fs.statAsync(this.memoFilePath);
        }
    
        // Open the file and create a buffer to read through.
        this.fd = await fs.openAsync(path, 'r');
        let buffer = new Buffer(32);

        // Get the number of records and the header length.
        await fs.readAsync(this.fd, buffer, 0, 32, 0);

        this.fileVersion = buffer.readUInt8(0);
        this.lastModified = {
            year: buffer.readInt8(1),
            month: buffer.readInt8(2),
            day: buffer.readInt8(3),
        };

        assert(supportedFileVersions.indexOf(this.fileVersion) !== -1, 'Unknown file or file version.');
    
        this.recordCount = buffer.readInt32LE(4);
        this._headerLength = buffer.readInt16LE(8);
        this._recordLength = buffer.readInt16LE(10);

        // Parse all field descriptors.
        
        var fieldsCount = 1;
        while (true) {

            await fs.readAsync(this.fd, buffer, 0, 32, fieldsCount*32);

            if (buffer.readUInt8(0) === 0x0D) {
                break;
            }

            var field = {
                name: buffer.toString(options.charset, 0, 10).split('\0')[0],
                type: String.fromCharCode(buffer[0x0B]),
                size: buffer.readUInt8(0x10),
                decs: buffer.readUInt8(0x11)
            };
            
            this.fields.push(field);
            fieldsCount++;
        
            assert(fieldsCount*32 <= this._headerLength, 'Missing header terminate byte.');
        }

        // Parse the header terminator.
        await fs.readAsync(this.fd, buffer, 0, 1, 32 + (this.fields.length * 32));
        assert(buffer[0] === 0x0d, 'Invalid DBF: Expected header terminator');
        
        return this;
    }
    
    bufferSubstr(buffer, start, count) {
        return buffer.toString(this.charset, start, start + count);
    }

    async readRecords(maxRows) {
        if (maxRows === undefined) {
            maxRows = 10000000;
        }
        
        let rowsInBuffer = 1000;
        let bufferSize = this._recordLength * rowsInBuffer;

        let buffer = new Buffer(this._recordLength * rowsInBuffer);

        // Seek to the file position at which to start reading.
        var currentPosition = (this._headerLength + this._recordLength * this._recordsRead) - 1;
        await fs.readAsync(this.fd, buffer, 0, 1, currentPosition);
        currentPosition += 1;

        // Read rows in chunks, until enough rows have been read.
        var rows = [];
        
        while (true) {
            // Work out how many rows to read in this chunk.
            var maxRows1 = this.recordCount - this._recordsRead;
            var maxRows2 = maxRows - rows.length;
            var rowsToRead = maxRows1 < maxRows2 ? maxRows1 : maxRows2;
            if (rowsToRead > rowsInBuffer)
                rowsToRead = rowsInBuffer;

            // Quit when no more rows to read.
            if (rowsToRead === 0)
                break;

            // Read the chunk of rows into the buffer.
            await fs.readAsync(this.fd, buffer, 0, this._recordLength * rowsToRead, currentPosition);

            currentPosition += this._recordLength * rowsToRead;
            this._recordsRead += rowsToRead;

            for (var i = 0, offset = 0; i < rowsToRead; ++i) {
                var row = { _raw: {} };
                var isDeleted = (buffer[offset++] === 0x2a);
                if (isDeleted) {
                    offset += this._recordLength - 1;
                    continue;
                }

                for (var j = 0; j < this.fields.length; ++j) {
                    let field = this.fields[j];
                    var len = field.size, value = null;

                    // Keep raw buffer data for each field value.
                    row._raw[field.name] = buffer.slice(offset, offset + field.size);

                    switch (field.type) {
                        case 'C':
                            while (len > 0 && buffer[offset + len - 1] === 0x20)
                                --len;
                            value = this.bufferSubstr(buffer, offset, len);
                            offset += field.size;
                            break;
                        case 'N':
                            while (len > 0 && buffer[offset] === 0x20)
                                ++offset, --len;
                            value = len > 0 ? parseFloat(this.bufferSubstr(buffer, offset, len)) : null;
                            offset += len;
                            break;
                        case 'L':
                            var c = String.fromCharCode(buffer[offset++]);
                            value = 'TtYy'.indexOf(c) >= 0 ? true : ('FfNn'.indexOf(c) >= 0 ? false : null);
                            break;
                        case 'D':
                            value = buffer[offset] === 0x20 ? null : moment(this.bufferSubstr(buffer, offset, 8), "YYYYMMDD").toDate();
                            offset += 8;
                            break;
                        case 'M':
                            assert(this.memoFilePath !== false && this.memoFilePath !== undefined, 'Missing memo file path. Options arg. memoFile key.');
                            if (this.memoFile === undefined) {
                                switch (p.extname(this.memoFilePath)) {
                                    case '.fpt':
                                        this.memoFile = new FPTMemoFile(this.charset);
                                        break;
                                    default:
                                        assert(false, 'Unknown memo file extension');
                                }

                                await this.memoFile.open(this.memoFilePath);
                            }

                            let positionString = this.bufferSubstr(buffer, offset, len);
                            if (positionString.trim().length > 0) {
                                let poisition = parseInt(positionString);
                                value = await this.memoFile.getMemo(poisition);
                            }
                            
                            offset += 10;
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
            buffer = new Buffer(this._recordLength * rowsInBuffer);
        }

        // Return all the rows that were read.
        return rows;
    }
    
    async close() {
        if (this.fd !== undefined) {
            await fs.closeAsync(this.fd);
        }
    }
    
    create(path, fields) {
        // return createDBF(path, fields);
    }
}

module.exports = DBFFile;
