import * as path from 'path';
import * as rimraf from 'rimraf'
import {expect} from 'chai';
import {DBFFile} from 'dbffile';




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
            addValues: (row: Record<string, unknown>, i: number) => ({...row, NO: i}),
            firstRow: { AFCLPD: 'W', AFHRPW: 2.92308, AFLVCL: 0.00, AFCRDA: new Date('1999-03-25'), AFPSDS: '', NO: 0 },
        },
    ];

    rimraf.sync(path.join(__dirname, `./fixtures/*.out`));

    tests.forEach(test => {
        it(test.filename, async () => {
            let srcPath = path.join(__dirname, `./fixtures/${test.filename}`);
            let dstPath = path.join(__dirname, `./fixtures/${test.filename}.out`);

            let srcDbf = await DBFFile.open(srcPath);
            let dstDbf = await DBFFile.create(dstPath, srcDbf.fields.concat(test.addFields));

            let rows = await srcDbf.readRecords(100);
            await dstDbf.append(rows.map(test.addValues));

            dstDbf = await DBFFile.open(dstPath);
            rows = await dstDbf.readRecords(500);
            let firstRow = rows[0];
            expect(dstDbf.recordCount).equal(test.rowCount);
            expect(firstRow).to.deep.include(test.firstRow);
        });
    });
});
