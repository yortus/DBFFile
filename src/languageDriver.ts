/**
 * Taken here: https://learn.microsoft.com/en-us/previous-versions/visualstudio/foxpro/8t45x02s(v=vs.71)
 */
export const LanguageDriverIdToCodepage = {
    0x01: 437, // U.S. MS-DOS
    0x02: 850, // International MS-DOS
    0x03: 1252, // Windows ANSI
    0x04: 10000, // Standard Macintosh    
    0x61: 865, // Nordic MS - DOS
    0x64: 852, // Eastern European MS-DOS
    0x65: 866, // Russian MS - DOS
    0x66: 865, // Nordic MS - DOS
    0x67: 861, // Icelandic MS - DOS
    0x68: 895, // Kamenicky(Czech) MS - DOS
    0x69: 620, // Mazovia (Polish) MS-DOS
    0x6A: 737, // Greek MS-DOS (437G)
    0x6B: 857, // Turkish MS - DOS    
    0x78: 950, // Chinese Windows
    0x7A: 936, // Chinese(PRC, Singapore) Windows
    0x7B: 932, // Japanese Windows
    0x7C: 874, // Thai Windows
    0x7D: 1255, // Hebrew Windows
    0x7E: 1256, // Arabic Windows
    0x7F: 10029, // Macintosh EE    
    0x96: 10007, // Russian Macintosh
    0x97: 10029, // Macintosh EE
    0x98: 10006, // Greek Macintosh
    0x99: 10007, // Russian Macintosh    
    0xC8: 1250, // Eastern European Windows
    0xC9: 1251, // Russian Windows
    0xCA: 1254, // Turkish Windows
    0xCB: 1253  // Greek Windows    
};