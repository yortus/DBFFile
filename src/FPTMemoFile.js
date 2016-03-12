"use strict";

require('babel-polyfill');

const assert = require('assert'),
    Promise = require('bluebird'),
    fs = Promise.promisifyAll(require('fs'));

class FPTMemoFile
{
    constructor(charset) {
        this.charset = charset;
    }
    
    async open(path) {
        this.path = path;
        this.fd = await fs.openAsync(this.path, 'r');
        this.shortBuffer = new Buffer(8);
        this.header;
        this.fieldBuffer;
        this.stat = await fs.statAsync(this.path);
    }
    
    async initIndex() {
        if (this.header !== undefined) {
            return;
        }
        
        this.index = [];
        
        // while (true)
        await fs.readAsync(this.fd, this.shortBuffer, 0, 8, 0);
        this.header = {
            blockSize: this.shortBuffer.readUInt16BE(6)
        };
    }
    
    async getMemo(fieldNo) {
        if (this.header === undefined) {
            await this.initIndex();
        }

        let fieldHeaderPosition = this.header.blockSize * fieldNo;

        assert(this.stat.size > fieldHeaderPosition, 'Field number out of bounds: '+ fieldHeaderPosition +' file size: '+ this.stat.size);
        await fs.readAsync(this.fd, this.shortBuffer, 0, 8, fieldHeaderPosition);

        let fieldType = this.shortBuffer.readUInt32BE(0);
        let fieldSize = this.shortBuffer.readUInt32BE(4);

        if (this.fieldBuffer === undefined || this.fieldBuffer.length < fieldSize) {
            this.fieldBuffer = new Buffer(fieldSize);
        }

        await fs.readAsync(this.fd, this.fieldBuffer, 0, fieldSize, fieldHeaderPosition + 8);

        return this.fieldBuffer.toString(this.charset, 0, fieldSize);
    }
    
    async close() {
        if (this.fd !== undefined) {
            await fs.closeAsync(this.fd);
        }
    }
}

module.exports = FPTMemoFile;