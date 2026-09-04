/*
 * Generates the Clipper test fixtures used by test/reading-a-dbf-file.ts.
 *
 * Built and run with Harbour 3.2.0, the open-source CA-Clipper compatible compiler:
 *
 *     harbour clipper_fixtures.prg -n -q -I<harbour>/include -o clipper_fixtures.c
 *     cc clipper_fixtures.c -I<harbour>/include -L<harbour>/lib -lhbextern -lhbdebug -lhbvm \
 *        -lhbrtl -lhblang -lhbcpage -lgtcgi -lgtstd -lgtwin -lhbrdd -lrddntx -lrddcdx -lrddfpt \
 *        -lhbrdd -lhbuddall -lhbusrrdd -lhbsix -lhbhsx -lhbmacro -lhbcplr -lhbpp -lhbcommon \
 *        -lhbpcre -lhbzlib -lhbmainstd <system libs> -o clipper_fixtures
 *
 * Clipper stores character field lengths greater than 255 as a 16-bit value split across field
 * descriptor bytes 16 and 17:
 *     FIELD_LEN := nLength % 256        (byte 16)
 *     FIELD_DEC := int( nLength / 256 ) (byte 17)
 * Harbour writes and reads this for every 'C' field - see hb_dbfCreate()/hb_dbfOpen() in
 * src/rdd/dbf1.c. The fixtures below cover the three cases DBFFile has to tell apart.
 */

#define HEADER_LAST_UPDATE      1
#define FIELD_DESC_OFFSET( n )  ( 32 + ( n ) * 32 )
#define FIELD_DESC_DECIMALS     17

PROCEDURE Main()

   /* 1. A genuine Clipper file with two character fields longer than 255 bytes.
    *    Declared record length (925) reconciles only with the 16-bit interpretation. */
   CreateLongCharFile( "clipper_long_char.dbf" )
   PatchDate( "clipper_long_char.dbf", 2024, 1, 3 )

   /* 2. A genuine Clipper file with only short character fields, then byte 17 of the CODE
    *    descriptor is overwritten with a non-zero value. This reproduces the files that made
    *    shapelib disable its 16-bit support (bug 1202) and that SocialExplorer/FastDBF#5 hit:
    *    byte 17 is a formatting hint, not a length high byte. The declared record length still
    *    reconciles with the standard interpretation, so the file must read exactly as it would
    *    with byte 17 left at zero. */
   CreateShortCharFile( "clipper_decimals_not_length.dbf" )
   PatchDate( "clipper_decimals_not_length.dbf", 2001, 12, 31 )
   PatchByte( "clipper_decimals_not_length.dbf", FIELD_DESC_OFFSET( 1 ) + FIELD_DESC_DECIMALS, 2 )

   /* 3. The long character file with byte 17 of the CODE descriptor corrupted, so that neither
    *    the standard nor the 16-bit interpretation reconciles with the declared record length.
    *    Must be rejected rather than guessed at. */
   hb_MemoWrit( "clipper_long_char_corrupt.dbf", hb_MemoRead( "clipper_long_char.dbf" ) )
   PatchByte( "clipper_long_char_corrupt.dbf", FIELD_DESC_OFFSET( 1 ) + FIELD_DESC_DECIMALS, 1 )

   ? "ok"
   RETURN

STATIC PROCEDURE CreateLongCharFile( cFile )
   dbCreate( cFile, { ;
      { "ID",      "N",   5, 0 }, ;
      { "CODE",    "C",  10, 0 }, ;
      { "NOTES",   "C", 300, 0 }, ;
      { "SUMMARY", "C", 600, 0 }, ;
      { "ACTIVE",  "L",   1, 0 }, ;
      { "CREATED", "D",   8, 0 } } )
   USE ( cFile ) EXCLUSIVE

   APPEND BLANK
   REPLACE ID      WITH 1
   REPLACE CODE    WITH "ALPHA"
   REPLACE NOTES   WITH "The quick brown fox jumps over the lazy dog. " + ;
                        Replicate( "Text past the classic 255 byte limit. ", 3 )
   REPLACE SUMMARY WITH Replicate( "First record summary. ", 20 )
   REPLACE ACTIVE  WITH .T.
   REPLACE CREATED WITH SToD( "19970304" )

   APPEND BLANK
   REPLACE ID      WITH 2
   REPLACE CODE    WITH "BETA"
   REPLACE NOTES   WITH "Short value in a long field."
   REPLACE SUMMARY WITH ""
   REPLACE ACTIVE  WITH .F.
   REPLACE CREATED WITH SToD( "20011231" )

   APPEND BLANK
   REPLACE ID      WITH 3
   REPLACE CODE    WITH "GAMMA"
   REPLACE NOTES   WITH Replicate( "X", 300 )
   REPLACE SUMMARY WITH Replicate( "Y", 600 )
   REPLACE ACTIVE  WITH .T.
   REPLACE CREATED WITH SToD( "20240102" )
   DELETE

   APPEND BLANK
   REPLACE ID      WITH 4
   REPLACE CODE    WITH "DELTA"
   REPLACE NOTES   WITH "Last record."
   REPLACE SUMMARY WITH "Tail summary."
   REPLACE ACTIVE  WITH .F.
   REPLACE CREATED WITH SToD( "20240103" )

   dbCloseAll()
   RETURN

STATIC PROCEDURE CreateShortCharFile( cFile )
   dbCreate( cFile, { ;
      { "ID",      "N",  5, 0 }, ;
      { "CODE",    "C", 10, 0 }, ;
      { "NAME",    "C", 30, 0 }, ;
      { "ACTIVE",  "L",  1, 0 }, ;
      { "CREATED", "D",  8, 0 } } )
   USE ( cFile ) EXCLUSIVE

   APPEND BLANK
   REPLACE ID      WITH 1
   REPLACE CODE    WITH "ALPHA"
   REPLACE NAME    WITH "First row"
   REPLACE ACTIVE  WITH .T.
   REPLACE CREATED WITH SToD( "19970304" )

   APPEND BLANK
   REPLACE ID      WITH 2
   REPLACE CODE    WITH "BETA"
   REPLACE NAME    WITH "Second row"
   REPLACE ACTIVE  WITH .F.
   REPLACE CREATED WITH SToD( "20011231" )

   dbCloseAll()
   RETURN

/* Harbour stamps the header's date of last update with the current date on close. Overwrite it so that
 * regenerating the fixtures produces byte-for-byte identical files, and the tests stay deterministic. */
STATIC PROCEDURE PatchDate( cFile, nYear, nMonth, nDay )
   PatchByte( cFile, HEADER_LAST_UPDATE,     nYear - 1900 )
   PatchByte( cFile, HEADER_LAST_UPDATE + 1, nMonth )
   PatchByte( cFile, HEADER_LAST_UPDATE + 2, nDay )
   RETURN

STATIC PROCEDURE PatchByte( cFile, nOffset, nByte )
   LOCAL nHandle := FOpen( cFile, 1 /* write */ )
   FSeek( nHandle, nOffset, 0 /* from start */ )
   FWrite( nHandle, Chr( nByte ), 1 )
   FClose( nHandle )
   RETURN
