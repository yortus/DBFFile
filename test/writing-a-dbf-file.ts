'use strict';
import * as path from 'path';
import * as _ from 'lodash';
import * as Promise from 'bluebird';
var rimraf = Promise.promisify(require('rimraf'));
import {async, await} from 'asyncawait';
import {expect} from 'chai';
import * as DBFFile from 'dbffile';


describe('Writing a DBF file', () => {

    let tests = [
        {
            filename: 'PYACFL.DBF',
            rowCount: 15,
            firstRow: { AFCLPD: 'W', AFHRPW: 2.92308, AFLVCL: 0.00, AFCRDA: new Date(1999, 2, 25), AFPSDS: '' }
        },
    ];

    rimraf(path.join(__dirname, `./fixtures/*.out`));

    tests.forEach(test => {
        it(test.filename, async.cps (() => {
            let srcPath = path.join(__dirname, `./fixtures/${test.filename}`);
            let dstPath = path.join(__dirname, `./fixtures/${test.filename}.out`);

            let srcDbf = await (DBFFile.open(srcPath));
            let dstDbf = await (DBFFile.create(dstPath, srcDbf.fields));

            let rows = await (srcDbf.readRecords(100));
            await (dstDbf.append(rows));

            dstDbf = await (DBFFile.open(dstPath));
            rows = await (dstDbf.readRecords(500));
            let firstRow = _.pick(rows[0], _.keys(test.firstRow));
            expect(dstDbf.recordCount).equal(test.rowCount);
            expect(firstRow).deep.equal(test.firstRow);
        }));
    });
});
