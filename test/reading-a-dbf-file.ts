'use strict';
import * as path from 'path';
import * as _ from 'lodash';
import {expect} from 'chai';
import * as DBFFile from 'dbffile';
import {asyncTester} from './utils';

describe('Reading a DBF file', () => {

    let tests = [
        {
            filename: 'PYACFL.DBF',
            rowCount: 45,
            firstRow: { AFCLPD: 'W', AFHRPW: 2.92308, AFLVCL: 0.00, AFCRDA: new Date(1999, 2, 25), AFPSDS: '' },
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
        it(test.filename, asyncTester(async () => {
            let filepath = path.join(__dirname, `./fixtures/${test.filename}`);
            let expectedRows = test.rowCount;
            let expectedData = test.firstRow;
            let expectedDels = test.delCount;
            let expectedError = test.error;
            let actualRows = null;
            let actualData = null;
            let actualDels = null;
            let actualError = null;
            try {
                let dbf = await (DBFFile.open(filepath));
                let rows = await (dbf.readRecords(500));
                actualRows = dbf.recordCount;
                actualData = _.pick(rows[0], _.keys(expectedData));
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
                expect(actualData).deep.equal(expectedData);
                expect(actualDels).equals(expectedDels);
            }
        }));
    });
});
