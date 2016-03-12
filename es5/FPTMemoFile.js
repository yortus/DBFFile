"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { return step("next", value); }, function (err) { return step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

require('babel-polyfill');

var assert = require('assert'),
    Promise = require('bluebird'),
    fs = Promise.promisifyAll(require('fs'));

var FPTMemoFile = function () {
    function FPTMemoFile(charset) {
        _classCallCheck(this, FPTMemoFile);

        this.charset = charset;
    }

    _createClass(FPTMemoFile, [{
        key: 'open',
        value: function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee(path) {
                return regeneratorRuntime.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                this.path = path;
                                _context.next = 3;
                                return fs.openAsync(this.path, 'r');

                            case 3:
                                this.fd = _context.sent;

                                this.shortBuffer = new Buffer(8);
                                this.header;
                                this.fieldBuffer;
                                _context.next = 9;
                                return fs.statAsync(this.path);

                            case 9:
                                this.stat = _context.sent;

                            case 10:
                            case 'end':
                                return _context.stop();
                        }
                    }
                }, _callee, this);
            }));

            function open(_x) {
                return ref.apply(this, arguments);
            }

            return open;
        }()
    }, {
        key: 'initIndex',
        value: function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
                return regeneratorRuntime.wrap(function _callee2$(_context2) {
                    while (1) {
                        switch (_context2.prev = _context2.next) {
                            case 0:
                                if (!(this.header !== undefined)) {
                                    _context2.next = 2;
                                    break;
                                }

                                return _context2.abrupt('return');

                            case 2:

                                this.index = [];

                                // while (true)
                                _context2.next = 5;
                                return fs.readAsync(this.fd, this.shortBuffer, 0, 8, 0);

                            case 5:
                                this.header = {
                                    blockSize: this.shortBuffer.readUInt16BE(6)
                                };

                            case 6:
                            case 'end':
                                return _context2.stop();
                        }
                    }
                }, _callee2, this);
            }));

            function initIndex() {
                return ref.apply(this, arguments);
            }

            return initIndex;
        }()
    }, {
        key: 'getMemo',
        value: function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee3(fieldNo) {
                var fieldHeaderPosition, fieldType, fieldSize;
                return regeneratorRuntime.wrap(function _callee3$(_context3) {
                    while (1) {
                        switch (_context3.prev = _context3.next) {
                            case 0:
                                if (!(this.header === undefined)) {
                                    _context3.next = 3;
                                    break;
                                }

                                _context3.next = 3;
                                return this.initIndex();

                            case 3:
                                fieldHeaderPosition = this.header.blockSize * fieldNo;


                                assert(this.stat.size > fieldHeaderPosition, 'Field number out of bounds: ' + fieldHeaderPosition + ' file size: ' + this.stat.size);
                                _context3.next = 7;
                                return fs.readAsync(this.fd, this.shortBuffer, 0, 8, fieldHeaderPosition);

                            case 7:
                                fieldType = this.shortBuffer.readUInt32BE(0);
                                fieldSize = this.shortBuffer.readUInt32BE(4);


                                if (this.fieldBuffer === undefined || this.fieldBuffer.length < fieldSize) {
                                    this.fieldBuffer = new Buffer(fieldSize);
                                }

                                _context3.next = 12;
                                return fs.readAsync(this.fd, this.fieldBuffer, 0, fieldSize, fieldHeaderPosition + 8);

                            case 12:
                                return _context3.abrupt('return', this.fieldBuffer.toString(this.charset, 0, fieldSize));

                            case 13:
                            case 'end':
                                return _context3.stop();
                        }
                    }
                }, _callee3, this);
            }));

            function getMemo(_x2) {
                return ref.apply(this, arguments);
            }

            return getMemo;
        }()
    }, {
        key: 'close',
        value: function () {
            var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee4() {
                return regeneratorRuntime.wrap(function _callee4$(_context4) {
                    while (1) {
                        switch (_context4.prev = _context4.next) {
                            case 0:
                                if (!(this.fd !== undefined)) {
                                    _context4.next = 3;
                                    break;
                                }

                                _context4.next = 3;
                                return fs.closeAsync(this.fd);

                            case 3:
                            case 'end':
                                return _context4.stop();
                        }
                    }
                }, _callee4, this);
            }));

            function close() {
                return ref.apply(this, arguments);
            }

            return close;
        }()
    }]);

    return FPTMemoFile;
}();

module.exports = FPTMemoFile;