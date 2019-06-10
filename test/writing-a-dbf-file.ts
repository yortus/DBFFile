import {expect} from 'chai';
import {DBFFile} from 'dbffile';
import * as path from 'path';
import * as rimraf from 'rimraf'




describe('Writing a DBF file', () => {

    let tests = [
        {
            filename: 'PYACFL.DBF',
            recordCount: 15,
            newFields: [{
                name: 'NO',
                type: 'I',
                size: 4,
                decs: 0
            }],
            newRecord: (record: Record<string, unknown>, i: number) => ({...record, NO: i}),
            firstRecord: { AFCLPD: 'W', AFHRPW: 2.92308, AFLVCL: 0.00, AFCRDA: new Date('1999-03-25'), AFPSDS: '', NO: 0 },
        },
    ];

    rimraf.sync(path.join(__dirname, `./fixtures/*.out`));

    tests.forEach(test => {
        it(test.filename, async () => {
            let srcPath = path.join(__dirname, `./fixtures/${test.filename}`);
            let dstPath = path.join(__dirname, `./fixtures/${test.filename}.out`);

            let srcDbf = await DBFFile.open(srcPath);
            let dstDbf = await DBFFile.create(dstPath, srcDbf.fields.concat(test.newFields));

            let records = await srcDbf.readRecords(100);
            await dstDbf.appendRecords(records.map(test.newRecord));

            dstDbf = await DBFFile.open(dstPath);
            records = await dstDbf.readRecords(500);
            let firstRecord = records[0];
            expect(dstDbf.recordCount).equal(test.recordCount);
            expect(firstRecord).to.deep.include(test.firstRecord);
        });
    });
});
