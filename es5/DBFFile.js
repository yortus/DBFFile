'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { return step("next", value); }, function (err) { return step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _ = require('lodash');
var moment = require('moment');

var bluebird = require('bluebird');
var fs = bluebird.promisifyAll(require('fs'));
var assert = require('assert');
var p = require('path');
var FPTMemoFile = require('./FPTMemoFile.js');

require('babel-polyfill');

// Structural typing for DBF field metadata (can't use interface because that would need exporting).
var field;

var supportedFileVersions = [0x03, // FoxBASE+/FoxPro/Dbase III plus, no memo
0xF5 // FoxPro 2.x (or earlier) with memo
];

var DBFFile = function () {
    function DBFFile() {
        _classCallCheck(this, DBFFile);

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
        this._recordsRead = 0;
    }

    _createClass(DBFFile, [{
        key: 'open',
        value: function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee(path, options) {
                var defaults, buffer, fieldsCount, field;
                return regeneratorRuntime.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                defaults = {
                                    memoFile: false,
                                    charset: 'utf8'
                                };

                                options = options || defaults;

                                if (options.charset !== undefined) {
                                    this.charset = options.charset;
                                }

                                if (!(options.memoFilePath !== undefined)) {
                                    _context.next = 7;
                                    break;
                                }

                                this.memoFilePath = options.memoFilePath;

                                _context.next = 7;
                                return fs.statAsync(this.memoFilePath);

                            case 7:
                                _context.next = 9;
                                return fs.openAsync(path, 'r');

                            case 9:
                                this.fd = _context.sent;
                                buffer = new Buffer(32);

                                // Get the number of records and the header length.

                                _context.next = 13;
                                return fs.readAsync(this.fd, buffer, 0, 32, 0);

                            case 13:

                                this.fileVersion = buffer.readUInt8(0);
                                this.lastModified = {
                                    year: buffer.readInt8(1),
                                    month: buffer.readInt8(2),
                                    day: buffer.readInt8(3)
                                };

                                assert(supportedFileVersions.indexOf(this.fileVersion) !== -1, 'Unknown file or file version.');

                                this.recordCount = buffer.readInt32LE(4);
                                this._headerLength = buffer.readInt16LE(8);
                                this._recordLength = buffer.readInt16LE(10);

                                // Parse all field descriptors.

                                fieldsCount = 1;

                            case 20:
                                if (!true) {
                                    _context.next = 31;
                                    break;
                                }

                                _context.next = 23;
                                return fs.readAsync(this.fd, buffer, 0, 32, fieldsCount * 32);

                            case 23:
                                if (!(buffer.readUInt8(0) === 0x0D)) {
                                    _context.next = 25;
                                    break;
                                }

                                return _context.abrupt('break', 31);

                            case 25:
                                field = {
                                    name: buffer.toString(options.charset, 0, 10).split('\0')[0],
                                    type: String.fromCharCode(buffer[0x0B]),
                                    size: buffer.readUInt8(0x10),
                                    decs: buffer.readUInt8(0x11)
                                };


                                this.fields.push(field);
                                fieldsCount++;

                                assert(fieldsCount * 32 <= this._headerLength, 'Missing header terminate byte.');
                                _context.next = 20;
                                break;

                            case 31:
                                _context.next = 33;
                                return fs.readAsync(this.fd, buffer, 0, 1, 32 + this.fields.length * 32);

                            case 33:
                                assert(buffer[0] === 0x0d, 'Invalid DBF: Expected header terminator');

                                return _context.abrupt('return', this);

                            case 35:
                            case 'end':
                                return _context.stop();
                        }
                    }
                }, _callee, this);
            }));

            function open(_x, _x2) {
                return ref.apply(this, arguments);
            }

            return open;
        }()
    }, {
        key: 'bufferSubstr',
        value: function bufferSubstr(buffer, start, count) {
            return buffer.toString(this.charset, start, start + count);
        }
    }, {
        key: 'readRecords',
        value: function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee2(maxRows) {
                var rowsInBuffer, bufferSize, buffer, currentPosition, rows, maxRows1, maxRows2, rowsToRead, i, offset, row, isDeleted, j, _field, len, value, c, positionString, poisition;

                return regeneratorRuntime.wrap(function _callee2$(_context2) {
                    while (1) {
                        switch (_context2.prev = _context2.next) {
                            case 0:
                                if (maxRows === undefined) {
                                    maxRows = 10000000;
                                }

                                rowsInBuffer = 1000;
                                bufferSize = this._recordLength * rowsInBuffer;
                                buffer = new Buffer(this._recordLength * rowsInBuffer);

                                // Seek to the file position at which to start reading.

                                currentPosition = this._headerLength + this._recordLength * this._recordsRead - 1;
                                _context2.next = 7;
                                return fs.readAsync(this.fd, buffer, 0, 1, currentPosition);

                            case 7:
                                currentPosition += 1;

                                // Read rows in chunks, until enough rows have been read.
                                rows = [];

                            case 9:
                                if (!true) {
                                    _context2.next = 79;
                                    break;
                                }

                                // Work out how many rows to read in this chunk.
                                maxRows1 = this.recordCount - this._recordsRead;
                                maxRows2 = maxRows - rows.length;
                                rowsToRead = maxRows1 < maxRows2 ? maxRows1 : maxRows2;

                                if (rowsToRead > rowsInBuffer) rowsToRead = rowsInBuffer;

                                // Quit when no more rows to read.

                                if (!(rowsToRead === 0)) {
                                    _context2.next = 16;
                                    break;
                                }

                                return _context2.abrupt('break', 79);

                            case 16:
                                _context2.next = 18;
                                return fs.readAsync(this.fd, buffer, 0, this._recordLength * rowsToRead, currentPosition);

                            case 18:

                                currentPosition += this._recordLength * rowsToRead;
                                this._recordsRead += rowsToRead;

                                i = 0, offset = 0;

                            case 21:
                                if (!(i < rowsToRead)) {
                                    _context2.next = 76;
                                    break;
                                }

                                row = { _raw: {} };
                                isDeleted = buffer[offset++] === 0x2a;

                                if (!isDeleted) {
                                    _context2.next = 27;
                                    break;
                                }

                                offset += this._recordLength - 1;
                                return _context2.abrupt('continue', 73);

                            case 27:
                                j = 0;

                            case 28:
                                if (!(j < this.fields.length)) {
                                    _context2.next = 72;
                                    break;
                                }

                                _field = this.fields[j];
                                len = _field.size, value = null;

                                // Keep raw buffer data for each field value.

                                row._raw[_field.name] = buffer.slice(offset, offset + _field.size);

                                _context2.t0 = _field.type;
                                _context2.next = _context2.t0 === 'C' ? 35 : _context2.t0 === 'N' ? 39 : _context2.t0 === 'L' ? 43 : _context2.t0 === 'D' ? 46 : _context2.t0 === 'M' ? 49 : 67;
                                break;

                            case 35:
                                while (len > 0 && buffer[offset + len - 1] === 0x20) {
                                    --len;
                                }value = this.bufferSubstr(buffer, offset, len);
                                offset += _field.size;
                                return _context2.abrupt('break', 68);

                            case 39:
                                while (len > 0 && buffer[offset] === 0x20) {
                                    ++offset, --len;
                                }value = len > 0 ? parseFloat(this.bufferSubstr(buffer, offset, len)) : null;
                                offset += len;
                                return _context2.abrupt('break', 68);

                            case 43:
                                c = String.fromCharCode(buffer[offset++]);

                                value = 'TtYy'.indexOf(c) >= 0 ? true : 'FfNn'.indexOf(c) >= 0 ? false : null;
                                return _context2.abrupt('break', 68);

                            case 46:
                                value = buffer[offset] === 0x20 ? null : moment(this.bufferSubstr(buffer, offset, 8), "YYYYMMDD").toDate();
                                offset += 8;
                                return _context2.abrupt('break', 68);

                            case 49:
                                assert(this.memoFilePath !== false && this.memoFilePath !== undefined, 'Missing memo file path. Options arg. memoFile key.');

                                if (!(this.memoFile === undefined)) {
                                    _context2.next = 59;
                                    break;
                                }

                                _context2.t1 = p.extname(this.memoFilePath);
                                _context2.next = _context2.t1 === '.fpt' ? 54 : 56;
                                break;

                            case 54:
                                this.memoFile = new FPTMemoFile(this.charset);
                                return _context2.abrupt('break', 57);

                            case 56:
                                assert(false, 'Unknown memo file extension');

                            case 57:
                                _context2.next = 59;
                                return this.memoFile.open(this.memoFilePath);

                            case 59:
                                positionString = this.bufferSubstr(buffer, offset, len);

                                if (!(positionString.trim().length > 0)) {
                                    _context2.next = 65;
                                    break;
                                }

                                poisition = parseInt(positionString);
                                _context2.next = 64;
                                return this.memoFile.getMemo(poisition);

                            case 64:
                                value = _context2.sent;

                            case 65:

                                offset += 10;
                                return _context2.abrupt('break', 68);

                            case 67:
                                throw new Error("Type '" + _field.type + "' is not supported");

                            case 68:

                                row[_field.name] = value;

                            case 69:
                                ++j;
                                _context2.next = 28;
                                break;

                            case 72:

                                //add the row to the result.
                                rows.push(row);

                            case 73:
                                ++i;
                                _context2.next = 21;
                                break;

                            case 76:

                                // Allocate a new buffer, so that all the raw buffer slices created above arent't invalidated.
                                buffer = new Buffer(this._recordLength * rowsInBuffer);
                                _context2.next = 9;
                                break;

                            case 79:
                                return _context2.abrupt('return', rows);

                            case 80:
                            case 'end':
                                return _context2.stop();
                        }
                    }
                }, _callee2, this);
            }));

            function readRecords(_x3) {
                return ref.apply(this, arguments);
            }

            return readRecords;
        }()
    }, {
        key: 'close',
        value: function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee3() {
                return regeneratorRuntime.wrap(function _callee3$(_context3) {
                    while (1) {
                        switch (_context3.prev = _context3.next) {
                            case 0:
                                if (!(this.fd !== undefined)) {
                                    _context3.next = 3;
                                    break;
                                }

                                _context3.next = 3;
                                return fs.closeAsync(this.fd);

                            case 3:
                            case 'end':
                                return _context3.stop();
                        }
                    }
                }, _callee3, this);
            }));

            function close() {
                return ref.apply(this, arguments);
            }

            return close;
        }()
    }, {
        key: 'create',
        value: function create(path, fields) {
            // return createDBF(path, fields);
        }
    }]);

    return DBFFile;
}();

module.exports = DBFFile;