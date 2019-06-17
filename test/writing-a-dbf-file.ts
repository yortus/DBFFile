import {expect} from 'chai';
import {DBFFile, FieldDescriptor, Options} from 'dbffile';
import * as path from 'path';
import * as rimraf from 'rimraf'




describe('Writing a DBF file', () => {

    interface Test {
        /** The name of the DBF file fixture to copy from (not the full path). */
        filename: string;

        /** The options to use when opening/creating the source/target DBF files. */
        options?: Options;

        /** The expected number of records in the source file. */
        recordCount: number;

        /** Field descriptors for fields added while copying from source to target file. */
        newFields: FieldDescriptor[];

        /** Function to map from a source record to a target record while copying. */
        newRecord: (record: Record<string, unknown>, i: number) => object;

        /** Expected field values in the first record of the target file. */
        firstRecord: Record<string, unknown>;
    }

    let tests: Test[] = [
        {
            filename: 'PYACFL.DBF',
            recordCount: 15,
            newFields: [{ name: 'NO', type: 'I', size: 4 }],
            newRecord: (record, i) => ({ ...record, NO: i }),
            firstRecord: { AFCLPD: 'W', AFHRPW: 2.92308, AFLVCL: 0.00, AFCRDA: new Date('1999-03-25'), AFPSDS: '', NO: 0 },
        },
        {
            filename: 'WSPMST.dbf',
            options: { encoding: 'tis620' },
            recordCount: 100,
            newFields: [{ name: 'FIELD1', type: 'C', size: 20 }],
            newRecord: record => ({ ...record, FIELD1: 'ทดสอบ' }),
            firstRecord: { DISPNAME: 'รองเท้าบุรุษADDA 61S02-M1', GROUP: '5', LEVEL: 'N', FIELD1: 'ทดสอบ' },
        },
        {
            filename: 'dbase_03_fixed.dbf',
            recordCount: 14,
            newFields: [{ name: 'FLOAT1', type: 'F', size: 20, decimalPlaces: 3 }],
            newRecord: record => ({ ...record, FLOAT1: Math.ceil(record.Northing as number) / 1000 }),
            firstRecord: { Circular_D: '12', Condition: 'Good', Northing: 557904.898, FLOAT1: 5.57905e2 },
        },
    ];

    rimraf.sync(path.join(__dirname, `./fixtures/*.out`));

    tests.forEach(test => {
        it(test.filename, async () => {
            let srcPath = path.join(__dirname, `./fixtures/${test.filename}`);
            let dstPath = path.join(__dirname, `./fixtures/${test.filename}.out`);

            let srcDbf = await DBFFile.open(srcPath, test.options);
            let dstDbf = await DBFFile.create(dstPath, srcDbf.fields.concat(test.newFields), test.options);

            let records = await srcDbf.readRecords(100);
            await dstDbf.appendRecords(records.map(test.newRecord));

            dstDbf = await DBFFile.open(dstPath, test.options);
            records = await dstDbf.readRecords(500);
            let firstRecord = records[0];
            expect(dstDbf.recordCount).equal(test.recordCount);
            expect(firstRecord).to.deep.include(test.firstRecord);
        });
    });
});
