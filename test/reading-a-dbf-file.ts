import {expect} from 'chai';
import {DBFFile, OpenOptions, DELETED} from 'dbffile';
import * as path from 'path';




describe('Reading a DBF file', () => {

    interface Test {

        /** Test description. */
        description: string;

        /** The name of the DBF file fixture to read (not the full path). */
        filename: string;

        /** The options to use when opening the DBF file. */
        options?: OpenOptions;

        /** The expected number of records in the file. Leave undefined if `error` is defined. */
        recordCount?: number;

        /** The expected date of last update. Leave undefined if `error` is defined. */
        dateOfLastUpdate?: Date;

        /** Expected field values in the first record. Leave undefined if `error` is defined. */
        firstRecord?: Record<string, unknown> & {[DELETED]?: true};

        /** Expected field values in the last record. Leave undefined if `error` is defined. */
        lastRecord?: Record<string, unknown> & {[DELETED]?: true};

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
            dateOfLastUpdate: new Date('2014-04-14'),
            firstRecord: {AFCLPD: 'W', AFHRPW: 2.92308, AFLVCL: 0.00, AFCRDA: new Date('1999-03-25'), AFPSDS: ''},
            lastRecord: {AFCLPD: 'W', AFHRPW: 0, AFLVCL: 0.00, AFCRDA: new Date('1991-04-15'), AFPSDS: ''},
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
            dateOfLastUpdate: new Date('1919-05-03'),
            firstRecord: {DISPNAME: 'ÃÍ§à·éÒºØÃØÉADDA 61S02-M1', GROUP: '5', LEVEL: 'N'},
            lastRecord: {DISPNAME: '', GROUP: 'W', LEVEL: 'S'},
            deletedCount: 5,
        },
        {
            description: 'DBF stored with non-default encoding, read using correct encoding',
            filename: 'WSPMST.DBF',
            options: {encoding: 'tis620'},
            recordCount: 6802,
            dateOfLastUpdate: new Date('1919-05-03'),
            firstRecord: {DISPNAME: 'รองเท้าบุรุษADDA 61S02-M1', PNAME: 'รองเท้า CASUAL', GROUP: '5', LEVEL: 'N'},
            lastRecord: {DISPNAME: '', PNAME: 'รองเท้า B-GRADE', GROUP: 'W', LEVEL: 'S'},
            deletedCount: 5,
        },
        {
            description: 'DBF read with multiple field-specific encodings',
            filename: 'WSPMST.DBF',
            options: {encoding: {default: 'tis620', PNAME: 'latin1'}},
            recordCount: 6802,
            dateOfLastUpdate: new Date('1919-05-03'),
            firstRecord: {DISPNAME: 'รองเท้าบุรุษADDA 61S02-M1', PNAME: 'ÃÍ§à·éÒ CASUAL'},
            lastRecord: {DISPNAME: '', PNAME: 'ÃÍ§à·éÒ B-GRADE'},
            deletedCount: 5,
        },
        {
            description: 'DBF with memo file (version 0x83)',
            filename: 'dbase_83.dbf',
            recordCount: 67,
            dateOfLastUpdate: new Date('2003-12-18'),
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
            dateOfLastUpdate: new Date('2000-06-12'),
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
            dateOfLastUpdate: new Date('1919-11-06'),
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
            description: 'VFP9 DBF with memo file (version 0x30)',
            filename: 'vfp9_30_memo.dbf',
            recordCount: 3,
            dateOfLastUpdate: new Date('1921-10-12'),
            firstRecord: {
                ID: 1,
                MEMO: 'Memo of record 1. Which needs to be very long to be bigger than 64 bytes and take 2 memo blocks',
                CHAR: 'Text1',
                NUM: 999.50,
                DATE: new Date('2021-10-11'),
                TIME: new Date('2021-10-11 22:34:50 GMT'),
            },
            lastRecord: {
                ID: 3,
                MEMO: 'Memo of record 3',
                CHAR: 'Text3',
                NUM: 10.11,
                DATE: new Date('2020-01-01'),
                TIME: new Date('2020-01-01 12:12:12 GMT'),
            },
            deletedCount: 1,
        },
        {
            description: `DBF with unsupported file version and field types in 'strict' (default) read mode`,
            filename: 'dbase_31.dbf',
            error: 'unknown/unsupported dBase version: 49',
        },
        {
            description: `DBF with unsupported file version and field types in 'loose' read mode`,
            filename: 'dbase_31.dbf',
            options: {readMode: 'loose'},
            recordCount: 77,
            dateOfLastUpdate: new Date('1902-08-02'),
            firstRecord: {PRODUCTID: 1, PRODUCTNAM: 'Chai', REORDERLEV: 10, DISCONTINU: false},
            lastRecord: {PRODUCTID: 77, PRODUCTNAM: 'Original Frankfurter grüne Soáe', REORDERLEV: 15, DISCONTINU: false},
            deletedCount: 0,
        },
        {
            description: `DBF with missing memo file in 'strict' (default) read mode`,
            filename: 'dbase_8b_missing_memo.dbf',
            error: `Memo file not found`,
        },
        {
            description: `DBF with missing memo file in 'loose' read mode`,
            filename: 'dbase_8b_missing_memo.dbf',
            options: {readMode: 'loose'},
            recordCount: 10,
            dateOfLastUpdate: new Date('2000-06-12'),
            firstRecord: {NUMERICAL: 1, LOGICAL: true, FLOAT: 1.23456789012346},
            lastRecord: {NUMERICAL: 10, DATE: null, LOGICAL: null, FLOAT: 0.1},
            deletedCount: 0,
        },
        {
            description: 'DBF with deleted records included in results',
            filename: 'PYACFL.DBF',
            options: {includeDeletedRecords: true},
            recordCount: 45,
            dateOfLastUpdate: new Date('2014-04-14'),
            firstRecord: {[DELETED]: true, AFCLPD: 'W', AFHRPW: 0, AFACCL: 'P', AFCRDA: new Date('1991-04-15'), AFPSDS: ''},
            lastRecord: {AFCLPD: 'W', AFHRPW: 0, AFLVCL: 0.00, AFCRDA: new Date('1991-04-15'), AFPSDS: ''},
            deletedCount: 0,
        },
    ];

    tests.forEach(test => {
        it(test.description, async () => {
            let filepath = path.join(__dirname, `./fixtures/${test.filename}`);
            let options = test.options;
            let expectedRecordCount = test.recordCount;
            let expectedDateOfLastUpdate = test.dateOfLastUpdate;
            let expectedFirstRecord = test.firstRecord;
            let expectedLastRecord = test.lastRecord;
            let expectedDeletedCount = test.deletedCount;
            let expectedError = test.error;

            let dbf: DBFFile;
            let records: Array<Record<string, unknown> & {[DELETED]?: true}>;
            try {
                dbf = await DBFFile.open(filepath, options);
                records = await dbf.readRecords();
            }
            catch (err:any) {
                expect(err.message).contains(expectedError ?? '??????');
                return;
            }
            expect(dbf.recordCount, 'the record count should match').equals(expectedRecordCount);
            expect(dbf.dateOfLastUpdate, 'the date of last update should match').deep.equals(expectedDateOfLastUpdate);
            expect(records[0], 'first record should match').to.deep.include(expectedFirstRecord!);
            expect(records[0][DELETED], 'first record should match').equals(expectedFirstRecord![DELETED]);
            expect(records[records.length - 1], 'last record should match').to.deep.include(expectedLastRecord!);
            expect(records[records.length - 1][DELETED], 'last record should match').equals(expectedLastRecord![DELETED]);
            expect(dbf.recordCount - records.length, 'deleted records should match').equals(expectedDeletedCount);
            expect(undefined).equals(expectedError);
        });
    });
});
