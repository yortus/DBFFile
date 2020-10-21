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

        /** Expected field values in the last record. Leave undefined if `error` is defined. */
        lastRecord?: Record<string, unknown>;

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
            lastRecord: { AFCLPD: 'W', AFHRPW: 0, AFLVCL: 0.00, AFCRDA: new Date('1991-04-15'), AFPSDS: '' },
            deletedCount: 30,
        },
        {
            description: 'DBF with duplicated field name',
            filename: 'dbase_03.dbf',
            error: `Duplicate field name: 'Point_ID'`
        },
        {
            description: 'DBF stored with non-default encoding, read using default encoding',
            filename: 'WSPMST.DBF',
            recordCount: 6802,
            firstRecord: { DISPNAME: 'ÃÍ§à·éÒºØÃØÉADDA 61S02-M1', GROUP: '5', LEVEL: 'N' },
            lastRecord: { DISPNAME: '', GROUP: 'W', LEVEL: 'S' },
            deletedCount: 5,
        },
        {
            description: 'DBF stored with non-default encoding, read using correct encoding',
            filename: 'WSPMST.DBF',
            options: {encoding: 'tis620'},
            recordCount: 6802,
            firstRecord: { DISPNAME: 'รองเท้าบุรุษADDA 61S02-M1', PNAME: 'รองเท้า CASUAL', GROUP: '5', LEVEL: 'N' },
            lastRecord: { DISPNAME: '', PNAME: 'รองเท้า B-GRADE', GROUP: 'W', LEVEL: 'S' },
            deletedCount: 5,
        },
        {
            description: 'DBF read with multiple field-specific encodings',
            filename: 'WSPMST.DBF',
            options: { encoding: { default: 'tis620', PNAME: 'latin1' } },
            recordCount: 6802,
            firstRecord: { DISPNAME: 'รองเท้าบุรุษADDA 61S02-M1', PNAME: 'ÃÍ§à·éÒ CASUAL' },
            lastRecord: { DISPNAME: '', PNAME: 'ÃÍ§à·éÒ B-GRADE' },
            deletedCount: 5,
        },
        {
            description: 'DBF with memo file (version 0x83)',
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
            lastRecord: {
                ID: 94,
                CODE: 'BD02',
                NAME: 'Trio of Biscotti',
                WEIGHT: 0,
                DESC: 'This tin is filled with a tempting trio of crunchy pleasures that can be enjoyed by themselves or dunked into fresh cup of coffee. Our perennial favorite Biscotti di Divine returns, chockfull of toasted almonds, flavored with a hint of cinnamon, and half dipped into bittersweet chocolate. Two new twice-baked delights make their debut this season; Heavenly Chocolate Hazelnut and Golden Orange Pignoli. 16 biscotti are packed in a tin.  (1Lb. 2oz.)'
            },
            deletedCount: 0,
        },
        {
            description: 'DBF with memo file (version 0x8b)',
            filename: 'dbase_8b.dbf',
            recordCount: 10,
            firstRecord: {
                CHARACTER: 'One',
                NUMERICAL: 1,
                LOGICAL: true,
                FLOAT: 1.23456789012346,
                MEMO: 'First memo\r\n'
            },
            lastRecord: {
                CHARACTER: 'Ten records stored in this database',
                NUMERICAL: 10,
                DATE: null,
                LOGICAL: null,
                FLOAT: 0.1,
                MEMO: null
            },
            deletedCount: 0,
        },
        {
            description: 'VFP9 DBF without memo file (version 0x30)',
            filename: 'vfp9_30.dbf',
            recordCount: 3,
            firstRecord: {
                FIELD1: 'carlos manuel',
                FIELD2: new Date('2013-12-12'),
                FIELD3: new Date('2013-12-12 08:30:00 GMT'),
                FIELD4: 17000000000,
                FIELD5: 2500.55,
                FIELD6: true,
            },
            lastRecord: {
                FIELD1: 'ricardo enrique',
                FIELD2: new Date('2017-08-07'),
                FIELD3: new Date('2017-08-07 20:30:00 GMT'),
                FIELD4: 17000000000,
                FIELD5: 2500.45,
                FIELD6: true,
            },
            deletedCount: 1,
        },
        {
            description: 'DBF with unsupported version (0x31)',
            filename: 'dbase_31.dbf',
            error: 'unknown/unsupported dBase version: 49',
        },
    ];

    tests.forEach(test => {
        it(test.description, async () => {
            let filepath = path.join(__dirname, `./fixtures/${test.filename}`);
            let options = test.options;
            let expectedRecordCount = test.recordCount;
            let expectedFirstRecord: Record<string, unknown> | undefined = test.firstRecord;
            let expectedLastRecord: Record<string, unknown> | undefined = test.lastRecord;
            let expectedDeletedCount = test.deletedCount;
            let expectedError = test.error;
            try {
                let dbf = await DBFFile.open(filepath, options);
                let records = await dbf.readRecords();
                expect(dbf.recordCount, 'the record count should match').equals(expectedRecordCount);
                expect(records[0], 'first record should match').to.deep.include(expectedFirstRecord!);
                expect(records[records.length - 1], 'last record should match').to.deep.include(expectedLastRecord!);
                expect(dbf.recordCount - records.length, 'deleted records should match').equals(expectedDeletedCount);
            }
            catch (err) {
                expect(err.message).contains(expectedError || '??????');
                return;
            }
            expect(undefined).equals(expectedError);
        });
    });
});
