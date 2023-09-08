import * as assert from 'assert';
import * as iconv from 'iconv-lite';
import {extname} from 'path';
import {FieldDescriptor, validateFieldDescriptor} from './field-descriptor';
import {isValidFileVersion} from './file-version';
import {CreateOptions, Encoding, normaliseCreateOptions, normaliseOpenOptions, OpenOptions} from './options';
import {close, open, read, stat, write} from './utils';
import {createDate, format8CharDate, formatVfpDateTime, parseVfpDateTime, parse8CharDate} from './utils';




/** Represents a DBF file. */
export class DBFFile {

    /** Opens an existing DBF file. */
    static async open(path: string, options?: OpenOptions) {
        return openDBF(path, options);
    }

    /** Creates a new DBF file with no records. */
    static async create(path: string, fields: FieldDescriptor[], options?: CreateOptions) {
        return createDBF(path, fields, options);
    }

    /** Full path to the DBF file. */
    path = '';

    /** Total number of records in the DBF file. (NB: includes deleted records). */
    recordCount = 0;

    /** Date of last update as recorded in the DBF file header. */
    dateOfLastUpdate!: Date;

    /** Metadata for all fields defined in the DBF file. */
    fields = [] as FieldDescriptor[];

    /**
     * Reads a subset of records from this DBF file. If the `includeDeletedRecords` option is set, then deleted records
     * are included in the results, otherwise they are skipped. Deleted records have the property `[DELETED]: true`,
     * using the `DELETED` symbol exported from this library.
     */
    readRecords(maxCount = 10000000) {
        return readRecordsFromDBF(this, maxCount);
    }

    /** Appends the specified records to this DBF file. */
    appendRecords(records: any[]) {
        return appendRecordsToDBF(this, records);
    }

    /**
     * Iterates over each record in this DBF file. If the `includeDeletedRecords` option is set, then deleted records
     * are yielded, otherwise they are skipped. Deleted records have the property `[DELETED]: true`, using the `DELETED`
     * symbol exported from this library.
     */
     async *[Symbol.asyncIterator]() {
        while (this._recordsRead !== this.recordCount) {
            yield* await this.readRecords(100);
        }
    }

    // Private.
    _readMode = 'strict' as 'strict' | 'loose';
    _encoding = '' as Encoding;
    _includeDeletedRecords = false;
    _recordsRead = 0;
    _headerLength = 0;
    _recordLength = 0;
    _memoPath? = '';
    _version? = 0;
}




/** Symbol used for detecting deleted records when the `includeDeletedRecords` option is used. */
export const DELETED = Symbol();




//-------------------- Private implementation starts here --------------------
async function openDBF(path: string, opts?: OpenOptions): Promise<DBFFile> {
    let options = normaliseOpenOptions(opts);
    let fd = 0;
    try {
        // Open the file and create a buffer to read through.
        fd = await open(path, 'r');
        let buffer = Buffer.alloc(32);

        // Read various properties from the header record.
        await read(fd, buffer, 0, 32, 0);
        let fileVersion = buffer.readUInt8(0);
        let lastUpdateY = buffer.readUInt8(1); // number of years after 1900
        let lastUpdateM = buffer.readUInt8(2); // 1-based
        let lastUpdateD = buffer.readUInt8(3); // 1-based
        const dateOfLastUpdate = createDate(lastUpdateY + 1900, lastUpdateM, lastUpdateD);
        let recordCount = buffer.readInt32LE(4);
        let headerLength = buffer.readInt16LE(8);
        let recordLength = buffer.readInt16LE(10);
        let memoPath: string | undefined;

        // Validate the file version. Skip validation if reading in 'loose' mode.
        if (options.readMode !== 'loose' && !isValidFileVersion(fileVersion)) {
            throw new Error(`File '${path}' has unknown/unsupported dBase version: ${fileVersion}.`);
        }

        // Locate the memo file, if any. Allow missing memo files if reading in 'loose' mode.
        if (fileVersion === 0x83 || fileVersion === 0x8b) {
            for (const ext of ['.dbt', '.DBT']) {
                memoPath = path.slice(0, -extname(path).length) + ext;
                let foundMemoFile = await stat(memoPath).catch(() => 'missing') !== 'missing';
                if (foundMemoFile) break;
                memoPath = undefined;
            }
            if (options.readMode !== 'loose' && !memoPath) {
                throw new Error(`Memo file not found for file '${path}'.`);
            }
        }
        // Locate FoxPro9 memo file, if any. Version 0x30 may or may not have a memo file.
        // Conventions for memo extensions: .dbf => .fpt | .pjx => .pjt | .scx => .sct | .vcx => .vct | .frx => .frt ...
        if (fileVersion === 0x30) {
            const dbExt = extname(path).toLowerCase();
            const memoExt = dbExt == '.dbf' ? '.fpt' : `.${dbExt.substr(1,2)}t`;
            for (const ext of [memoExt, memoExt.toUpperCase()]) {
                memoPath = path.slice(0, -extname(path).length) + ext;
                let foundMemoFile = await stat(memoPath).catch(() => 'missing') !== 'missing';
                if (foundMemoFile) break;
                memoPath = undefined;
            }
        }

        // Parse and validate all field descriptors. Skip validation if reading in 'loose' mode.
        let fields: FieldDescriptor[] = [];
        let encoding = getEncoding(options.encoding);
        while (headerLength > 32 + fields.length * 32) {
            await read(fd, buffer, 0, 32, 32 + fields.length * 32);
            if (buffer.readUInt8(0) === 0x0D) break;
            let field: FieldDescriptor = {
                name: iconv.decode(buffer.slice(0, 10), encoding).split('\0')[0],
                type: String.fromCharCode(buffer[0x0B]) as FieldDescriptor['type'],
                size: buffer.readUInt8(0x10),
                decimalPlaces: buffer.readUInt8(0x11)
            };
            if (options.readMode !== 'loose') {
                validateFieldDescriptor(field, fileVersion);
                assert(fields.every(f => f.name !== field.name), `Duplicate field name: '${field.name}'`);
            }
            fields.push(field);
        }

        // Parse the header terminator.
        await read(fd, buffer, 0, 1, 32 + fields.length * 32);
        assert(buffer[0] === 0x0d, 'Invalid DBF: Expected header terminator');

        // Validate the record length.
        const computedRecordLength = calculateRecordLengthInBytes(fields);
        if (options.readMode === 'loose') recordLength = computedRecordLength;
        assert(recordLength === computedRecordLength, 'Invalid DBF: Incorrect record length');

        // Return a new DBFFile instance.
        let result = new DBFFile();
        result.path = path;
        result.recordCount = recordCount;
        result.dateOfLastUpdate = dateOfLastUpdate;
        result.fields = fields;
        result._readMode = options.readMode;
        result._encoding = options.encoding;
        result._includeDeletedRecords = options.includeDeletedRecords;
        result._recordsRead = 0;
        result._headerLength = headerLength;
        result._recordLength = recordLength;
        result._memoPath = memoPath;
        result._version = fileVersion;
        return result;
    }
    finally {
        // Close the file.
        if (fd) await close(fd);
    }
};




async function createDBF(path: string, fields: FieldDescriptor[], opts?: CreateOptions): Promise<DBFFile> {
    let options = normaliseCreateOptions(opts);
    let fd = 0;
    try {
        // Validate the field metadata.
        let fileVersion = options.fileVersion;
        validateFieldDescriptors(fields, fileVersion);

        // Disallow creation of DBF files with memo fields.
        // TODO: Lift this restriction when memo support is fully implemented.
        if (fields.some(f => f.type === 'M')) throw new Error(`Writing to files with memo fields is not supported.`);

        // Create the file and create a buffer to write through.
        fd = await open(path, 'wx');
        let buffer = Buffer.alloc(32);

        // Write the header structure up to the field descriptors.
        buffer.writeUInt8(fileVersion, 0x00);                       // Version
        let now = new Date();                                       // date of last update (YYMMDD)
        buffer.writeUInt8(now.getFullYear() - 1900, 0x01);          // YY (year minus 1900)
        buffer.writeUInt8(now.getMonth()/* 0-based */ + 1, 0x02);   // MM (1-based)
        buffer.writeUInt8(now.getDate()/* 1-based */, 0x03);        // DD (1-based)
        buffer.writeInt32LE(0, 0x04);                               // Number of records (set to zero)
        let headerLength = 34 + (fields.length * 32);
        buffer.writeUInt16LE(headerLength, 0x08);                   // Length of header structure
        let recordLength = calculateRecordLengthInBytes(fields);
        buffer.writeUInt16LE(recordLength, 0x0A);                   // Length of each record
        buffer.writeUInt32LE(0, 0x0C);                              // Reserved/unused (set to zero)
        buffer.writeUInt32LE(0, 0x10);                              // Reserved/unused (set to zero)
        buffer.writeUInt32LE(0, 0x14);                              // Reserved/unused (set to zero)
        buffer.writeUInt32LE(0, 0x18);                              // Reserved/unused (set to zero)
        buffer.writeUInt32LE(0, 0x1C);                              // Reserved/unused (set to zero)
        await write(fd, buffer, 0, 32, 0);

        // Write the field descriptors.
        for (let i = 0; i < fields.length; ++i) {
            let {name, type, size, decimalPlaces} = fields[i];
            iconv.encode(name, 'ISO-8859-1').copy(buffer, 0);       // Field name (up to 10 chars)
            for (let j = name.length; j < 11; ++j) {                // null terminator(s)
                buffer.writeUInt8(0, j);
            }
            buffer.writeUInt8(type.charCodeAt(0), 0x0B);            // Field type
            buffer.writeUInt32LE(0, 0x0C);                          // Field data address (set to zero)
            buffer.writeUInt8(size, 0x10);                          // Field length
            buffer.writeUInt8(decimalPlaces || 0, 0x11);            // Decimal count
            buffer.writeUInt16LE(0, 0x12);                          // Reserved (set to zero)
            buffer.writeUInt8(0x01, 0x14);                          // Work area ID (always 01h for dBase III)
            buffer.writeUInt16LE(0, 0x15);                          // Reserved (set to zero)
            buffer.writeUInt8(0, 0x17);                             // Flag for SET fields (set to zero)
            buffer.writeUInt32LE(0, 0x18);                          // Reserved (set to zero)
            buffer.writeUInt32LE(0, 0x1C);                          // Reserved (set to zero)
            buffer.writeUInt8(0, 0x1F);                             // Index field flag (set to zero)
            await write(fd, buffer, 0, 32, 32 + i * 32);
        }

        // Write the header terminator and EOF marker.
        buffer.writeUInt8(0x0D, 0);                             // Header terminator
        buffer.writeUInt8(0x00, 1);                             // Null byte (unnecessary but common, accounted for in header length)
        buffer.writeUInt8(0x1A, 2);                             // EOF marker
        await write(fd, buffer, 0, 3, 32 + fields.length * 32);

        // Return a new DBFFile instance.
        let result = new DBFFile();
        result.path = path;
        result.recordCount = 0;
        result.dateOfLastUpdate = createDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
        result.fields = fields.map(field => ({...field})); // make new copy of field descriptors
        result._readMode = 'strict';
        result._encoding = options.encoding;
        result._recordsRead = 0;
        result._headerLength = headerLength;
        result._recordLength = recordLength;
        return result;
    }
    finally {
        // Close the file.
        if (fd) await close(fd);
    }
};




// Private implementation of DBFFile#readRecords
async function readRecordsFromDBF(dbf: DBFFile, maxCount: number) {
    let fd = 0;
    let memoFd = 0;
    try {
        // Open the file and prepare to create a buffer to read through.
        fd = await open(dbf.path, 'r');
        let recordCountPerBuffer = 1000;
        let recordLength = dbf._recordLength;
        let buffer = Buffer.alloc(recordLength * recordCountPerBuffer);

        // If there is a memo file, open it and get the block size. Also get the total file size for overflow checking.
        // The code below assumes the block size is at offset 4 in the .dbt for dBase IV files, and defaults to 512 if
        // all zeros. For dBase III files, the block size is always 512 bytes.
        let memoBlockSize = 0;
        let memoFileSize = 0;
        let memoBuf: Buffer | undefined;
        if (dbf._memoPath) {
            memoFd = await open(dbf._memoPath, 'r');
            if (dbf._version === 0x30) {
                // FoxPro9 
                await read(memoFd, buffer, 0, 2, 6);
                memoBlockSize = buffer.readUInt16BE(0) || 512;
            } else {
                // dBASE
                await read(memoFd, buffer, 0, 4, 4);
                memoBlockSize = (dbf._version === 0x8b ? buffer.readInt32LE(0) : 0) || 512;
            }
            memoBuf = Buffer.alloc(memoBlockSize);
            memoFileSize = (await stat(dbf._memoPath)).size;
        }

        // Calculate the file position at which to start reading.
        let currentPosition = dbf._headerLength + recordLength * dbf._recordsRead;

        // Create convenience functions for extracting values from the buffer.
        let substrAt = (start: number, len: number, enc: string) => iconv.decode(buffer.slice(start, start + len), enc);
        let int32At = (start: number, len: number) => buffer.slice(start, start + len).readInt32LE(0);

        // Read records in chunks, until enough records have been read.
        let records: Array<Record<string, unknown> & {[DELETED]?: true}> = [];
        while (true) {

            // Work out how many records to read in this chunk.
            let maxRecords1 = dbf.recordCount - dbf._recordsRead;
            let maxRecords2 = maxCount - records.length;
            let recordCountToRead = maxRecords1 < maxRecords2 ? maxRecords1 : maxRecords2;
            if (recordCountToRead > recordCountPerBuffer) recordCountToRead = recordCountPerBuffer;

            // Quit when there are no more records to read.
            if (recordCountToRead === 0) break;

            // Read the chunk of records into the buffer.
            await read(fd, buffer, 0, recordLength * recordCountToRead, currentPosition);
            dbf._recordsRead += recordCountToRead;
            currentPosition += recordLength * recordCountToRead;

            // Parse each record.
            for (let i = 0, offset = 0; i < recordCountToRead; ++i) {
                let record: Record<string, unknown> & {[DELETED]?: true} = {};
                let isDeleted = (buffer[offset++] === 0x2a);
                if (isDeleted && !dbf._includeDeletedRecords) {
                    offset += recordLength - 1;
                    continue;
                }

                // Parse each field.
                for (let j = 0; j < dbf.fields.length; ++j) {
                    let field = dbf.fields[j];
                    let len = field.size;
                    let value: any = null;
                    let encoding = getEncoding(dbf._encoding, field);

                    // Decode the field from the buffer, according to its type.
                    switch (field.type) {
                        case 'C': // Text
                            while (len > 0 && buffer[offset + len - 1] === 0x20) --len;
                            value = substrAt(offset, len, encoding);
                            offset += field.size;
                            break;

                        case 'N': // Number
                        case 'F': // Float - appears to be treated identically to Number
                            while (len > 0 && buffer[offset] === 0x20) ++offset, --len;
                            value = len > 0 ? parseFloat(substrAt(offset, len, encoding)) : null;
                            offset += len;
                            break;

                        case 'L': // Boolean
                            let c = String.fromCharCode(buffer[offset++]);
                            value = 'TtYy'.indexOf(c) >= 0 ? true : ('FfNn'.indexOf(c) >= 0 ? false : null);
                            break;

                        case 'T': // DateTime
                            if (buffer[offset] === 0x20) {
                                value = null;
                            }
                            else {
                                const julianDay = buffer.readInt32LE(offset);
                                const msSinceMidnight = buffer.readInt32LE(offset + 4) + 1;
                                value = parseVfpDateTime({julianDay, msSinceMidnight});
                            }
                            offset += 8;
                            break;

                        case 'D': // Date
                            value = buffer[offset] === 0x20 ? null : parse8CharDate(substrAt(offset, 8, encoding));
                            offset += 8;
                            break;

                        case 'B': // Double
                            value = buffer.readDoubleLE(offset);
                            offset += field.size;
                            break;

                        case 'I': // Integer
                            value = buffer.readInt32LE(offset);
                            offset += field.size;
                            break;

                        case 'M': // Memo
                            let blockIndex = dbf._version === 0x30
                                ? int32At(offset, len)
                                : parseInt(substrAt(offset, len, encoding));
                            offset += len;
                            if(isNaN(blockIndex) || blockIndex === 0) {
                                value = null;
                                break;
                            }

                            // If the memo file is missing and we get this far, we must be in 'loose' read mode.
                            // Skip reading the memo value and continue with the next field.
                            if (!memoBuf) continue;

                            // Start with an empty memo value, and concatenate to it until the memo value is fully read.
                            value = '';
                            let mergedBuffer = Buffer.from([]);

                            // Read the memo data from the memo file. We use a while loop here to read one block-sized
                            // chunk at a time, since memo values can be larger than the block size.
                            while (true) {

                                // Read the next block-sized chunk from the memo file.
                                await read(memoFd, memoBuf, 0, memoBlockSize, blockIndex * memoBlockSize);

                                // Handle first/next block of dBase III memo data.
                                if (dbf._version === 0x83) {
                                    // dBase III memos don't have a length header, rather they are terminated with two
                                    // 0x1A bytes. However when FoxPro is used to modify a dBase III file, it writes
                                    // only a single 0x1A byte to mark the end of a memo. Some files therefore have both
                                    // markers (ie 0x1A1A and 0x1A) present in the same file for different records. This
                                    // reader therefore only looks for a single 0x1A byte to mark the end of the memo,
                                    // so that it picks up both dBase III and FoxPro variations. (Previously this code
                                    // only checked for 0x1A1A in 0x83 files, and read past the end of the memo file
                                    // for some user-submitted test files because it missed single 0x1A markers).
                                    // If the terminator is not found in the current block-sized buffer, then the memo
                                    // value must be larger than a single block size. In that case, we continue the loop
                                    // and read the next block-sized chunk, and so on until the terminator is found.
                                    let eos = memoBuf.indexOf('\x1A');
                                    mergedBuffer = Buffer.concat([mergedBuffer, memoBuf.slice(0, eos === -1 ? memoBlockSize : eos)]);
                                    if (eos !== -1) {
                                        value = iconv.decode(mergedBuffer, encoding);
                                        break; // break out of the loop once we've found the terminator.
                                    }
                                }

                                // Handle first/next block of dBase IV memo data.
                                else if (dbf._version === 0x8b) {
                                    // dBase IV memos start with FF-FF-08-00, then a four-byte memo length, which
                                    // includes the eight-byte memo 'header' in the length. The memo length can be
                                    // larger than a block, so we loop over blocks until done.

                                    // If this is the first block of the memo, then read the field length.
                                    // Otherwise, we must have already read the length in a previous loop iteration.
                                    let isFirstBlockOfMemo = memoBuf.readInt32LE(0) === 0x0008FFFF;
                                    if (isFirstBlockOfMemo) len = memoBuf.readUInt32LE(4) - 8;

                                    // Read the chunk of memo data, and break out of the loop when all read.
                                    let skip = isFirstBlockOfMemo ? 8 : 0;
                                    let take = Math.min(len, memoBlockSize - skip);
                                    mergedBuffer = Buffer.concat([mergedBuffer, memoBuf.slice(skip, skip + take)]);
                                    len -= take;
                                    if (len === 0) {
                                        value = iconv.decode(mergedBuffer, encoding);
                                        break;
                                    }
                                }

                                // Handle first/next block of FoxPro9 memo data.
                                else if (dbf._version === 0x30) {
                                    // Memo header
                                    // 00 - 03: Next free block
                                    // 04 - 05: Not used
                                    // 06 - 07: Block size
                                    // 08 - 511: Not used

                                    // Memo Block
                                    // 00 - 03: Type: 0 = image, 1 = text
                                    // 04 - 07: Length
                                    // 08 - N : Data

                                    let skip = 0;
                                    if (!mergedBuffer.length) {
                                        const memoType = memoBuf.readInt32BE(0);
                                        if (memoType != 1) break;
                                        len = memoBuf.readInt32BE(4);
                                        skip = 8;
                                    }
                                    
                                    // Read the chunk of memo data, and break out of the loop when all read.
                                    let take = Math.min(len, memoBlockSize - skip);
                                    mergedBuffer = Buffer.concat([mergedBuffer, memoBuf.slice(skip, skip + take)]);
                                    len -= take;
                                    if (len === 0) {
                                        value = iconv.decode(mergedBuffer, encoding);
                                        break;
                                    }
                                }
                                else {
                                    throw new Error(`Reading version ${dbf._version} memo fields is not supported.`);
                                }
                                ++blockIndex;
                                if (blockIndex * memoBlockSize > memoFileSize) {
                                    throw new Error(`Error reading memo file (read past end).`);
                                }
                            }
                            break;

                        default:
                            // Throw an error if reading in 'strict' mode
                            if (dbf._readMode === 'strict') throw new Error(`Type '${field.type}' is not supported`);

                            // Skip over the field data if reading in 'loose' mode
                            if (dbf._readMode === 'loose') {
                                offset += field.size;
                                continue;
                            }
                    }
                    record[field.name] = value;
                }

                // If the record is marked as deleted, add the `[DELETED]` flag.
                if (isDeleted) record[DELETED] = true;

                // Add the record to the result.
                records.push(record);
            }
        }

        // Return all the records that were read.
        return records;
    }
    finally {
        // Close the file(s).
        if (fd) await close(fd);
        if (memoFd) await close(memoFd);
    }
};




// Private implementation of DBFFile#appendRecords
async function appendRecordsToDBF(dbf: DBFFile, records: Array<Record<string, unknown>>): Promise<DBFFile> {
    let fd = 0;
    try {
        // Open the file and create a buffer to read and write through.
        fd = await open(dbf.path, 'r+');
        let recordLength = calculateRecordLengthInBytes(dbf.fields);
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
                let value: any = record[field.name];
                if (value === null || typeof value === 'undefined') value = '';
                let encoding = getEncoding(dbf._encoding, field);

                // Encode the field in the buffer, according to its type.
                switch (field.type) {

                    case 'C': // Text
                        let b = iconv.encode(value, encoding);
                        for (let k = 0; k < field.size; ++k) {
                            let byte = k < b.length ? b[k] : 0x20;
                            buffer.writeUInt8(byte, offset++);
                        }
                        break;

                    case 'N': // Number
                    case 'F': // Float - appears to be treated identically to Number
                        value = value.toString();
                        value = value.slice(0, field.size);
                        while (value.length < field.size) value = ' ' + value;
                        iconv.encode(value, encoding).copy(buffer, offset, 0, field.size);
                        offset += field.size;
                        break;

                    case 'L': // Boolean
                        buffer.writeUInt8(value === '' ? 0x20 : value ? 0x54/* 'T' */ : 0x46/* 'F' */, offset++);
                        break;

                    case 'T': // DateTime
                        if (!value) {
                            iconv.encode('        ', encoding).copy(buffer, offset, 0, 8);
                        }
                        else {
                            const {julianDay, msSinceMidnight} = formatVfpDateTime(value);
                            buffer.writeInt32LE(julianDay, offset);
                            buffer.writeInt32LE(msSinceMidnight, offset + 4);
                        }
                        offset += 8;
                        break;

                    case 'D': // Date
                        value = value ? format8CharDate(value) : '        ';
                        iconv.encode(value, encoding).copy(buffer, offset, 0, 8);
                        offset += 8;
                        break;

                    case 'B': // Double
                        buffer.writeDoubleLE(value, offset);
                        offset += field.size;
                        break;

                    case 'I': // Integer
                        buffer.writeInt32LE(value, offset);
                        offset += field.size;
                        break;

                    case 'M': // Memo
                        // Disallow writing to DBF files with memo fields.
                        // TODO: Lift this restriction when memo support is fully implemented.
                        throw new Error(`Writing to files with memo fields is not supported.`);

                    default:
                        throw new Error(`Type '${field.type}' is not supported`);
                }
            }
            await write(fd, buffer, 0, recordLength, currentPosition);
            currentPosition += recordLength;
        }

        // Write a new EOF marker.
        buffer.writeUInt8(0x1A, 0);
        await write(fd, buffer, 0, 1, currentPosition);

        // Update the record count in the file and in the DBFFile instance.
        dbf.recordCount += records.length;
        buffer.writeInt32LE(dbf.recordCount, 0);
        await write(fd, buffer, 0, 4, 0x04);

        // Return the same DBFFile instance.
        return dbf;
    }
    finally {
        // Close the file.
        if (fd) await close(fd);
    }
};




// Private helper function
function validateFieldDescriptors(fields: FieldDescriptor[], fileVersion: number): void {
    if (fields.length > 2046) throw new Error('Too many fields (maximum is 2046)');
    for (let field of fields) validateFieldDescriptor(field, fileVersion);
}




// Private helper function
function validateRecord(fields: FieldDescriptor[], record: Record<string, unknown>): void {
    for (let i = 0; i < fields.length; ++i) {
        let name = fields[i].name, type = fields[i].type;
        let value = record[name];

        // Always allow null values
        if (value === null || typeof value === 'undefined') continue;

        // Perform type-specific checks
        if (type === 'C') {
            if (typeof value !== 'string') throw new Error(`${name}: expected a string`);
            if (value.length > 255) throw new Error(`${name}: text is too long (maximum length is 255 chars)`);
        }
        else if (type === 'N' || type === 'F' || type === 'I') {
            if (typeof value !== 'number') throw new Error(`${name}: expected a number`);
        }
        else if (type === 'D') {
            if (!(value instanceof Date)) throw new Error(`${name}: expected a date`);
        }
        else if (type === 'L') {
            if (typeof value !== 'boolean') throw new Error(`${name}: expected a boolean`);
        }
    }
}




// Private helper function
function calculateRecordLengthInBytes(fields: FieldDescriptor[]): number {
    let len = 1; // 'Record deleted flag' adds one byte
    for (let i = 0; i < fields.length; ++i) len += fields[i].size;
    return len;
}




// Private helper function
function getEncoding(encoding: Encoding, field?: FieldDescriptor) {
    if (typeof encoding === 'string') return encoding;
    return encoding[field?.name ?? 'default'] || encoding.default;
}
