import {expect} from 'chai';
import {DBFFile, Options} from 'dbffile';
import * as path from 'path';




describe('Reading a DBF file', () => {

    interface Test {
        /** The name of the DBF file fixture to read (not the full path). */
        filename: string;

        /** The options to use when opening the DBF file. */
        options?: Options;

        /** The expected number of records in the file. Leave undefined if `error` is defined. */
        recordCount?: number;

        /** Expected field values in the first record. Leave undefined if `error` is defined. */
        firstRecord?: Record<string, unknown>;

        /** Expected count of deleted records in the file. Leave undefined if `error` is defined. */
        deletedCount?: number;

        /** Expected error message, if any, when attempting to open/read the file. */
        error?: string;
    }

    let tests: Test[] = [
        {
            filename: 'PYACFL.DBF',
            recordCount: 45,
            firstRecord: { AFCLPD: 'W', AFHRPW: 2.92308, AFLVCL: 0.00, AFCRDA: new Date('1999-03-25'), AFPSDS: '' },
            deletedCount: 30,
        },
        {
            filename: 'dbase_03.dbf',
            error: `Duplicate field name: 'Point_ID'`
        },
        {
            filename: 'WSPMST.dbf',
            recordCount: 6802,
            firstRecord: {DISPNAME: 'ÃÍ§à·éÒºØÃØÉADDA 61S02-M1', GROUP: '5', LEVEL: 'N'},
            deletedCount: 6302,
        },
        {
            filename: 'WSPMST.dbf',
            options: {encoding: 'tis620'},
            recordCount: 6802,
            firstRecord: {DISPNAME: 'รองเท้าบุรุษADDA 61S02-M1', PNAME: 'รองเท้า CASUAL', GROUP: '5', LEVEL: 'N'},
            deletedCount: 6302,
        },
        {
            filename: 'WSPMST.dbf',
            options: {encoding: {default: 'tis620', PNAME: 'latin1'}},
            recordCount: 6802,
            firstRecord: {DISPNAME: 'รองเท้าบุรุษADDA 61S02-M1', PNAME: 'ÃÍ§à·éÒ CASUAL'},
            deletedCount: 6302,
        },
    ];

    tests.forEach(test => {
        it(test.filename, async () => {
            let filepath = path.join(__dirname, `./fixtures/${test.filename}`);
            let options = test.options;
            let expectedRecordCount = test.recordCount;
            let expectedFirstRecord: Record<string, unknown> | undefined = test.firstRecord;
            let expectedDeletedCount = test.deletedCount;
            let expectedError = test.error;
            let actualRecordCount: typeof expectedRecordCount;
            let actualFirstRecord: typeof expectedFirstRecord;
            let actualDeletedCount: typeof expectedDeletedCount;
            let actualError: typeof expectedError;
            try {
                let dbf = await DBFFile.open(filepath, options);
                let records = await dbf.readRecords(500);
                actualRecordCount = dbf.recordCount;
                actualFirstRecord = records[0];
                actualDeletedCount = dbf.recordCount - records.length;
            }
            catch (ex) {
                actualError = ex.message;
            }
            if (expectedError || actualError) {
                expect(actualError).equals(expectedError);
            }
            else {
                expect(actualRecordCount).equals(expectedRecordCount);
                expect(actualFirstRecord).to.deep.include(expectedFirstRecord!);
                expect(actualDeletedCount).equals(expectedDeletedCount);
            }
        });
    });
});
