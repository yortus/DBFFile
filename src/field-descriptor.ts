import {FileVersion} from './file-version';




/** Metadata describing a single field in a DBF file. */
export interface FieldDescriptor {

    /** The name of the field. Must be no longer than 10 characters. */
    name: string;

    /**
     * The single-letter code for the field type.
     * C=string, N=numeric, F=float, L=logical, D=date, I=integer, M=memo, T=datetime, D=double.
     */
    type: 'C' | 'N' | 'F' | 'L' | 'D' | 'I' | 'M' | 'T' | 'B';

    /** The size of the field in bytes. */
    size: number;

    /** The number of decimal places. Optional; only used for some field types. */
    decimalPlaces?: number;
}




export function validateFieldDescriptor(version: FileVersion, field: FieldDescriptor): void {
    let {name, type, size, decimalPlaces: decs} = field;

    // name
    if (typeof name !== 'string') throw new Error('Name must be a string');
    if (name.length < 1) throw new Error(`Field name '${name}' is too short (minimum is 1 char)`);
    if (name.length > 10) throw new Error(`Field name '${name}' is too long (maximum is 10 chars)`);

    // type
    if (typeof type !== 'string' || type.length !== 1) throw new Error('Type must be a single character');
    if (FieldTypes.indexOf(type) === -1) throw new Error(`Type '${type}' is not supported`);

    // size
    if (typeof size !== 'number') throw new Error('Size must be a number');
    if (size < 1) throw new Error('Field size is too small (minimum is 1)');
    if (type === 'C' && size > 255) throw new Error('Field size is too large (maximum is 255)');
    if (type === 'N' && size > 20) throw new Error('Field size is too large (maximum is 20)');
    if (type === 'F' && size > 20) throw new Error('Field size is too large (maximum is 20)');
    if (type === 'L' && size !== 1) throw new Error('Invalid field size (must be 1)');
    if (type === 'D' && size !== 8) throw new Error('Invalid field size (must be 8)');
    if (type === 'M' && size !== 10) throw new Error('Invalid field size (must be 10)');
    if (type === 'T' && size !== 8) throw new Error('Invalid field size (must be 8)');
    if (type === 'B' && size !== 8) throw new Error('Invalid field size (must be 8)');

    // decimalPlaces
    const maxDecimals = version === 0x8b ? 18 : 15;
    if (decs !== undefined && typeof decs !== 'number') throw new Error('decimalPlaces must be undefined or a number');
    if (decs && decs > maxDecimals) throw new Error('Decimal count is too large (maximum is 15)');
}




const FieldTypes: Array<FieldDescriptor['type']> = ['C', 'N', 'F', 'L', 'D', 'I', 'M', 'T', 'B'];
