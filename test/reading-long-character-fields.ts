import {expect} from 'chai';
import {DBFFile} from 'dbffile';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';




describe('Reading long character fields', () => {
    let fixturePaths: string[] = [];

    afterEach(() => {
        for (const fixturePath of fixturePaths) fs.unlinkSync(fixturePath);
        fixturePaths = [];
    });

    it('reads character field lengths stored across descriptor bytes 16 and 17', async () => {
        const fixturePath = createSyntheticDBF({
            characterFieldSize: 300,
            records: [
                {text: 'first long character field', count: 11},
                {text: 'second long character field', count: 22},
            ],
        });

        const dbf = await DBFFile.open(fixturePath);
        const records = await dbf.readRecords(10);

        expect(dbf.fields).deep.equals([
            {name: 'LONG_TEXT', type: 'C', size: 300, decimalPlaces: 0},
            {name: 'COUNT', type: 'N', size: 5, decimalPlaces: 0},
        ]);
        expect(records).deep.equals([
            {LONG_TEXT: 'first long character field', COUNT: 11},
            {LONG_TEXT: 'second long character field', COUNT: 22},
        ]);

        const looseDbf = await DBFFile.open(fixturePath, {readMode: 'loose'});
        expect(await looseDbf.readRecords(10)).deep.equals(records);
    });

    it('keeps the one-byte character length when it matches the record header', async () => {
        const fixturePath = createSyntheticDBF({
            characterFieldSize: 40,
            characterFieldHighByte: 1,
            records: [{text: 'standard character field', count: 33}],
        });

        const dbf = await DBFFile.open(fixturePath);
        const records = await dbf.readRecords(10);

        expect(dbf.fields[0]).deep.equals({name: 'LONG_TEXT', type: 'C', size: 40, decimalPlaces: 1});
        expect(records).deep.equals([{LONG_TEXT: 'standard character field', COUNT: 33}]);
    });

    it('rejects a record length that matches neither interpretation', async () => {
        const fixturePath = createSyntheticDBF({
            characterFieldSize: 40,
            characterFieldHighByte: 1,
            declaredRecordLength: 47,
            records: [{text: 'invalid layout', count: 44}],
        });

        let error: Error | undefined;
        try {
            await DBFFile.open(fixturePath);
        }
        catch (err) {
            error = err;
        }

        expect(error?.message).equals('Invalid DBF: Incorrect record length');
    });

    it('supports unsigned record lengths', async () => {
        const fixturePath = createSyntheticDBF({
            characterFieldSize: 40_000,
            records: [],
        });

        const dbf = await DBFFile.open(fixturePath);

        expect(dbf.fields[0]).deep.equals({name: 'LONG_TEXT', type: 'C', size: 40_000, decimalPlaces: 0});
    });

    it('keeps long character fields read-only', async () => {
        const fixturePath = path.join(os.tmpdir(), `dbffile-long-character-create-${process.pid}.dbf`);
        let error: Error | undefined;
        try {
            await DBFFile.create(fixturePath, [{name: 'LONG_TEXT', type: 'C', size: 300}]);
        }
        catch (err) {
            error = err;
        }

        expect(error?.message).equals('Field size is too large (maximum is 255)');
        expect(fs.existsSync(fixturePath)).equals(false);
    });

    interface SyntheticDBFOptions {
        characterFieldSize: number;
        characterFieldHighByte?: number;
        declaredRecordLength?: number;
        records: Array<{text: string, count: number}>;
    }

    function createSyntheticDBF(options: SyntheticDBFOptions): string {
        const headerLength = 32 + 2 * 32 + 1;
        const actualRecordLength = 1 + options.characterFieldSize + 5;
        const declaredRecordLength = options.declaredRecordLength ?? actualRecordLength;
        const buffer = Buffer.alloc(headerLength + options.records.length * actualRecordLength + 1, 0x20);

        buffer.fill(0, 0, headerLength);
        buffer.writeUInt8(0x03, 0);                            // dBASE III without memo
        buffer.writeUInt8(124, 1);                             // 2024-01-02
        buffer.writeUInt8(1, 2);
        buffer.writeUInt8(2, 3);
        buffer.writeUInt32LE(options.records.length, 4);
        buffer.writeUInt16LE(headerLength, 8);
        buffer.writeUInt16LE(declaredRecordLength, 10);

        writeFieldDescriptor(buffer, 32, 'LONG_TEXT', 'C', options.characterFieldSize & 0xff,
            options.characterFieldHighByte ?? options.characterFieldSize >> 8);
        writeFieldDescriptor(buffer, 64, 'COUNT', 'N', 5, 0);
        buffer.writeUInt8(0x0d, 96);

        for (let index = 0; index < options.records.length; ++index) {
            const record = options.records[index];
            const offset = headerLength + index * actualRecordLength;
            buffer.writeUInt8(0x20, offset);
            buffer.write(record.text, offset + 1, options.characterFieldSize, 'latin1');
            buffer.write(String(record.count).padStart(5, ' '), offset + 1 + options.characterFieldSize, 5, 'ascii');
        }
        buffer.writeUInt8(0x1a, buffer.length - 1);

        const fixturePath = path.join(os.tmpdir(), `dbffile-long-character-${process.pid}-${fixturePaths.length}.dbf`);
        fs.writeFileSync(fixturePath, buffer);
        fixturePaths.push(fixturePath);
        return fixturePath;
    }

    function writeFieldDescriptor(
        buffer: Buffer,
        offset: number,
        name: string,
        type: string,
        sizeLowByte: number,
        sizeHighByte: number
    ): void {
        buffer.write(name, offset, 10, 'ascii');
        buffer.write(type, offset + 11, 1, 'ascii');
        buffer.writeUInt8(sizeLowByte, offset + 16);
        buffer.writeUInt8(sizeHighByte, offset + 17);
    }
});
