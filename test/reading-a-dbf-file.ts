import * as path from 'path';
import {expect} from 'chai';
import * as DBFFile from 'dbffile';




describe('Reading a DBF file', () => {

    let tests = [
        {
            filename: 'PYACFL.DBF',
            rowCount: 45,
            firstRow: { AFCLPD: 'W', AFHRPW: 2.92308, AFLVCL: 0.00, AFCRDA: new Date('1999-03-25'), AFPSDS: '' },
            delCount: 30,
            error: null
        },
        {
            filename: 'dbase_03.dbf',
            rowCount: null,
            firstRow: null,
            delCount: null,
            error: `Duplicate field name: 'Point_ID'`
        }
    ];

    tests.forEach(test => {
        it(test.filename, async () => {
            let filepath = path.join(__dirname, `./fixtures/${test.filename}`);
            let expectedRows = test.rowCount;
            let expectedData: Record<string, unknown> | null = test.firstRow;
            let expectedDels = test.delCount;
            let expectedError = test.error;
            let actualRows: typeof expectedRows = null;
            let actualData: typeof expectedData = null;
            let actualDels: typeof expectedDels = null;
            let actualError: typeof expectedError = null;
            try {
                let dbf = await DBFFile.open(filepath);
                let rows = await dbf.readRecords(500);
                actualRows = dbf.recordCount;
                actualData = rows[0];
                actualDels = dbf.recordCount - rows.length;
            }
            catch (ex) {
                actualError = ex.message;
            }
            if (expectedError || actualError) {
                expect(actualError).equals(expectedError);
            }
            else {
                expect(actualRows).equals(expectedRows);
                expect(actualData).to.deep.include(expectedData!);
                expect(actualDels).equals(expectedDels);
            }
        });
    });
});
