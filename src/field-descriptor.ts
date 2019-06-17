



/** Metadata describing a single field in a DBF file. */
export interface FieldDescriptor {

    /** The name of the field. */
    name: string;

    /** The single-letter code for the field type. C=string, N=numeric, I=integer, L=logical, D=date. */
    type: 'C' | 'N' | 'I' | 'L' | 'D';

    /** The size of the field in bytes. */
    size: number;

    /** The number of decimal places. */
    decs?: number;
}
