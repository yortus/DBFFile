import {expect} from 'chai';
import {DBFFile, FieldDescriptor, Options} from 'dbffile';
import * as path from 'path';
import * as rimraf from 'rimraf'




describe('Writing a DBF file', () => {

    interface Test {

        /** Test description. */
        description: string;

        /** The name of the DBF file fixture to copy from (not the full path). */
        filename: string;

        /** The options to use when opening/creating the source/target DBF files. */
        options?: Partial<Options>;

        /** The expected number of records in the source file. */
        recordCount: number;

        /** Field descriptors for fields added while copying from source to target file. */
        newFields: FieldDescriptor[];

        /** Function to map from a source record to a target record while copying. */
        newRecord: (record: Record<string, unknown>, i: number) => object;

        /** Expected field values in the first record of the target file. */
        firstRecord: Record<string, unknown>;

        /** Expected error message, if any, when attempting to create/write the file. */
        error?: string;
    }

    let tests: Test[] = [
        {
            description: 'DBF with default encoding',
            filename: 'PYACFL.DBF',
            recordCount: 15,
            newFields: [{ name: 'NO', type: 'I', size: 4 }],
            newRecord: (record, i) => ({ ...record, NO: i }),
            firstRecord: { AFCLPD: 'W', AFHRPW: 2.92308, AFLVCL: 0.00, AFCRDA: new Date('1999-03-25'), AFPSDS: '', NO: 0 },
        },
        {
            description: 'DBF with non-default encoding',
            filename: 'WSPMST.DBF',
            options: { encoding: 'tis620' },
            recordCount: 100,
            newFields: [{ name: 'FIELD1', type: 'C', size: 20 }],
            newRecord: record => ({ ...record, FIELD1: 'ทดสอบ' }),
            firstRecord: { DISPNAME: 'รองเท้าบุรุษADDA 61S02-M1', GROUP: '5', LEVEL: 'N', FIELD1: 'ทดสอบ' },
        },
        {
            description: `DBF with an 'F' (float) field`,
            filename: 'dbase_03_fixed.dbf',
            recordCount: 14,
            newFields: [{ name: 'FLOAT1', type: 'F', size: 20, decimalPlaces: 3 }],
            newRecord: record => ({ ...record, FLOAT1: Math.ceil(record.Northing as number) / 1000 }),
            firstRecord: { Circular_D: '12', Condition: 'Good', Northing: 557904.898, FLOAT1: 5.57905e2 },
        },
        {
            description: `DBF with memo file (version 0x83)`,
            filename: 'dbase_83.dbf',
            recordCount: 0,
            newFields: [],
            newRecord: record => record,
            firstRecord: {},
            error: 'Writing to files with memo fields is not supported.',
        },
        {
            description: `DBF with memo file (version 0x8b)`,
            filename: 'dbase_8b.dbf',
            options: {fileVersion: 0x8b},
            recordCount: 0,
            newFields: [],
            newRecord: record => record,
            firstRecord: {},
            error: 'Writing to files with memo fields is not supported.',
        },
        {
            description: `VFP DBF with an 'T' (DateTime) field`,
            filename: 'vfp9_30.dbf',
            recordCount: 2,
            newFields: [],
            newRecord: record => record,
            firstRecord: {
                FIELD1: 'carlos manuel',
                FIELD2: new Date('2013-12-12'),
                FIELD3: new Date('2013-12-12 08:30:00 GMT'),
                FIELD4: 17000000000,
                FIELD5: 2500.55,
                FIELD6: true,
            },

        },
    ];

    rimraf.sync(path.join(__dirname, `./fixtures/*.out`));

    tests.forEach(test => {
        it(test.description, async () => {
            let expectedRecordCount = test.recordCount;
            let expectedFirstRecord: Record<string, unknown> | undefined = test.firstRecord;
            let expectedError = test.error;
            try {
                let srcPath = path.join(__dirname, `./fixtures/${test.filename}`);
                let dstPath = path.join(__dirname, `./fixtures/${test.filename}.out`);
                let srcDbf = await DBFFile.open(srcPath, test.options);
                let dstDbf = await DBFFile.create(dstPath, srcDbf.fields.concat(test.newFields), test.options);
                let records = await srcDbf.readRecords(100);
                await dstDbf.appendRecords(records.map(test.newRecord));
                dstDbf = await DBFFile.open(dstPath, test.options);
                records = await dstDbf.readRecords(500);
                expect(dstDbf.recordCount, 'the record count should match').equals(expectedRecordCount);
                expect(records[0], 'first record should match').to.deep.include(expectedFirstRecord!);
            }
            catch (err) {
                expect(err.message).equals(expectedError);
                return;
            }
            expect(undefined).equals(expectedError);
        });
    });
});
