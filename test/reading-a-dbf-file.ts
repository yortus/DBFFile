import {expect} from 'chai';
import {DBFFile, Options} from 'dbffile';
import * as path from 'path';




describe('Reading a DBF file', () => {

    interface Test {

        /** Test description. */
        description: string;

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
            description: 'DBF with default encoding',
            filename: 'PYACFL.DBF',
            recordCount: 45,
            firstRecord: { AFCLPD: 'W', AFHRPW: 2.92308, AFLVCL: 0.00, AFCRDA: new Date('1999-03-25'), AFPSDS: '' },
            deletedCount: 30,
        },
        {
            description: 'DBF with duplicated field name',
            filename: 'dbase_03.dbf',
            error: `Duplicate field name: 'Point_ID'`
        },
        {
            description: 'DBF stored with non-default encoding, read using default encoding',
            filename: 'WSPMST.dbf',
            recordCount: 6802,
            firstRecord: { DISPNAME: 'ÃÍ§à·éÒºØÃØÉADDA 61S02-M1', GROUP: '5', LEVEL: 'N' },
            deletedCount: 6302,
        },
        {
            description: 'DBF stored with non-default encoding, read using correct encoding',
            filename: 'WSPMST.dbf',
            options: {encoding: 'tis620'},
            recordCount: 6802,
            firstRecord: { DISPNAME: 'รองเท้าบุรุษADDA 61S02-M1', PNAME: 'รองเท้า CASUAL', GROUP: '5', LEVEL: 'N' },
            deletedCount: 6302,
        },
        {
            description: 'DBF read with multiple field-specific encodings',
            filename: 'WSPMST.dbf',
            options: { encoding: { default: 'tis620', PNAME: 'latin1' } },
            recordCount: 6802,
            firstRecord: { DISPNAME: 'รองเท้าบุรุษADDA 61S02-M1', PNAME: 'ÃÍ§à·éÒ CASUAL' },
            deletedCount: 6302,
        },
        {
            description: 'DBF with memo file',
            filename: 'dbase_83.dbf',
            recordCount: 67,
            firstRecord: {
                ID: 87,
                CODE: '1',
                NAME: 'Assorted Petits Fours',
                WEIGHT: 5.51,
                DESC: `Our Original assortment...a little taste of heaven for everyone.  Let us
                select a special assortment of our chocolate and pastel favorites for you.
                Each petit four is its own special hand decorated creation. Multi-layers of
                moist cake with combinations of specialty fillings create memorable cake
                confections. Varietes include; Luscious Lemon, Strawberry Hearts, White
                Chocolate, Mocha Bean, Roasted Almond, Triple Chocolate, Chocolate Hazelnut,
                Grand Orange, Plum Squares, Milk chocolate squares, and Raspberry Blanc.`.replace(/[\r\n]+\s*/g, '\r\n')
            },
            deletedCount: 0,
        },
    ];

    tests.forEach(test => {
        it(test.description, async () => {
            let filepath = path.join(__dirname, `./fixtures/${test.filename}`);
            let options = test.options;
            let expectedRecordCount = test.recordCount;
            let expectedFirstRecord: Record<string, unknown> | undefined = test.firstRecord;
            let expectedDeletedCount = test.deletedCount;
            let expectedError = test.error;
            try {
                let dbf = await DBFFile.open(filepath, options);
                let records = await dbf.readRecords(500);
                expect(dbf.recordCount).equals(expectedRecordCount);
                expect(records[0]).to.deep.include(expectedFirstRecord!);
                expect(dbf.recordCount - records.length).equals(expectedDeletedCount);
            }
            catch (err) {
                expect(err.message).equals(expectedError);
                return;
            }
            expect(undefined).equals(expectedError);
        });
    });
});
