'use strict';
import * as path from 'path';
import * as _ from 'lodash';
import {sync as rimraf} from 'rimraf'
import {expect} from 'chai';
import * as DBFFile from 'dbffile';

const ENCODING = 'latin1';
describe('Writing a DBF file', () => {

    let tests = [
        {
            filename: 'PYACFL.DBF',
            rowCount: 15,
            addFields: [{
                name: 'NO',
                type: 'I',
                size: 4,
                decs: 0
            }],
            addValues: (row, i) => ({
                ...row,
                NO: i
            }),
            firstRow: { AFCLPD: 'W', AFHRPW: 2.92308, AFLVCL: 0.00, AFCRDA: new Date(1999, 2, 25), AFPSDS: '', NO: 0 },
        },
    ];

    rimraf(path.join(__dirname, `./fixtures/*.out`));

    tests.forEach(test => {
        it(test.filename, async () => {
            let srcPath = path.join(__dirname, `./fixtures/${test.filename}`);
            let dstPath = path.join(__dirname, `./fixtures/${test.filename}.out`);

            let srcDbf = await (DBFFile.open(srcPath, ENCODING));
            let dstDbf = await (DBFFile.create(dstPath, srcDbf.fields.concat(test.addFields), ENCODING));

            let rows = await (srcDbf.readRecords(100, ENCODING));
            await (dstDbf.append(rows.map(test.addValues), ENCODING));

            dstDbf = await (DBFFile.open(dstPath, ENCODING));
            rows = await (dstDbf.readRecords(500, ENCODING));
            let firstRow = _.pick(rows[0], _.keys(test.firstRow));
            expect(dstDbf.recordCount).equal(test.rowCount);
            expect(firstRow).deep.equal(test.firstRow);
        });
    });
});
