///<reference path="../bluebird/bluebird.d.ts" />


declare module "DBFFile" {
    class DBFFile {

        /** Full path to the DBF file. */
        path: string;

        /** Total number of records in the DBF file. */
        recordCount: number;

        /** Metadata for all fields defined in the DBF file. */
        fields: { name: string; type: string; size: number; decs: number; }[];

        /** Append the specified records to this DBF file. */
        append(records: any[]): Promise<DBFFile>;

        /** Close this DBF file. */
        close();

        /** read some specific rows from the dbf file. **/
        readRecords(maxRows?: number): Promise<any[]>;

        /** Open an existing DBF file. */
        static open(path: string): Promise<DBFFile>;

        /** Creates a new DBF file with no records. */
        static create(path: string, fields: { name: string; type: string; size: number; decs: number; }[]): Promise<DBFFile>;
    }
    export = DBFFile;
}
