'use strict';
import * as path from 'path';
import * as _ from 'lodash';
import {async, await} from 'asyncawait';
import {expect} from 'chai';
import * as DBFFile from 'dbffile';


describe('Reading a DBF file', () => {

    let tests = [
        {
            filename: 'dbase_03.dbf',
            rowCount: 14,
            firstRow: { Point_ID: '0507121', Shape: 'circular', Std_Dev: 0.897088, GPS_Date: new Date(2005, 6, 12) }
        }
    ];

    tests.forEach(test => {
        it(test.filename, async.cps (() => {
            let filepath = path.join(__dirname, `./fixtures/${test.filename}`);
            let expectedRows = test.rowCount;
            let expectedData = test.firstRow;
            let actualRows = null;
            let actualData = null;
            try {
                let dbf = await (DBFFile.open(filepath));
                let rows = await (dbf.readRecords(1));
                actualRows = dbf.recordCount;
                actualData = _.pick(rows[0], _.keys(expectedData));
            }
            catch (ex) { }
            expect(actualRows).equals(expectedRows);
            expect(actualData).deep.equal(expectedData);
        }));
    });
});
