import {expect} from 'chai';
import {DBFFile} from 'dbffile';
import * as path from 'path';




describe('Reading a DBF file', () => {

    let tests = [
        {
            filename: 'PYACFL.DBF',
            recordCount: 45,
            firstRecord: { AFCLPD: 'W', AFHRPW: 2.92308, AFLVCL: 0.00, AFCRDA: new Date('1999-03-25'), AFPSDS: '' },
            deletedCount: 30,
            error: null
        },
        {
            filename: 'dbase_03.dbf',
            recordCount: null,
            firstRecord: null,
            deletedCount: null,
            error: `Duplicate field name: 'Point_ID'`
        }
    ];

    tests.forEach(test => {
        it(test.filename, async () => {
            let filepath = path.join(__dirname, `./fixtures/${test.filename}`);
            let expectedRecordCount = test.recordCount;
            let expectedFirstRecord: Record<string, unknown> | null = test.firstRecord;
            let expectedDeletedCount = test.deletedCount;
            let expectedError = test.error;
            let actualRecordCount: typeof expectedRecordCount = null;
            let actualFirstRecord: typeof expectedFirstRecord = null;
            let actualDeletedCount: typeof expectedDeletedCount = null;
            let actualError: typeof expectedError = null;
            try {
                let dbf = await DBFFile.open(filepath);
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
