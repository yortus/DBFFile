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
        'dbase_03.dbf'
    ];

    rimraf(path.join(__dirname, `./fixtures/*.out`));

    tests.forEach(test => {
        it(test, async.cps (() => {
            let srcPath = path.join(__dirname, `./fixtures/${test}`);
            let dstPath = path.join(__dirname, `./fixtures/${test}.out`);

            let srcDbf = await (DBFFile.open(srcPath));
            let tgtDbf = await (DBFFile.create(dstPath, srcDbf.fields));

            let rows = await (srcDbf.readRecords(100));

            await (tgtDbf.append(rows));

            // TODO: add assertions...            
        }));
    });
});
