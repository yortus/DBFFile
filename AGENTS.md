# AGENTS.md

This file provides guidance for AI coding agents working in this repository.

## Commands

```bash
npm run self-ref   # one-time: symlinks node_modules/dbffile -> dist/ (tests import 'dbffile')
npm run build      # tsc -p src, tsc -p test, then copies test/fixtures into dist/test/fixtures
npm test           # mocha ./dist/test  -- runs the COMPILED tests, so build first
npm run clean      # deletes dist/
npm run build:watch / npm run test:watch
```

There is no linter; `tsc` with `strict`, `noUnusedLocals`, `noUnusedParameters` is the only static check.

Tests must be built before they run. A full cycle is `npm run build && npm test`.

To run a single test, use mocha's grep against the compiled output, e.g.:

```bash
npm run build && npx mocha --timeout 999999 ./dist/test --grep "currency"
```

## Test architecture

Both test files (`test/reading-a-dbf-file.ts`, `test/writing-a-dbf-file.ts`) are table-driven: a `tests: Test[]`
array of case objects is iterated to generate `it(...)` blocks. Adding coverage almost always means adding one
entry to that array plus a fixture in `test/fixtures/`, not writing a new `it` block.

- Each case names a fixture file, optional `OpenOptions`/`CreateOptions`, and expected `recordCount`,
  `firstRecord`, `lastRecord`, `deletedCount`, or an expected `error` substring/message.
- Reading tests run each case twice — once via `readRecords()` and once via `for await` async iteration.
- Writing tests copy a fixture: open source → `DBFFile.create` target with source fields plus `newFields` →
  append records mapped through `newRecord` → reopen and verify. Targets are written as `<fixture>.out` next to
  the fixtures and deleted afterwards.
- Tests import the public API from `'dbffile'` (the self-ref symlink), not from relative `src/` paths, so they
  exercise the built package surface. `npm run self-ref` must have been run or every test fails to resolve.

## Code architecture

The public surface is tiny and re-exported from [src/index.ts](src/index.ts): the `DBFFile` class, the `DELETED`
symbol, `FieldDescriptor`, `OpenOptions`, `CreateOptions`.

[src/dbf-file.ts](src/dbf-file.ts) holds essentially all the logic and follows a deliberate split:

- The `DBFFile` class is a thin data holder. Its public methods (`open`, `create`, `readRecords`,
  `appendRecords`, `[Symbol.asyncIterator]`) delegate immediately to free functions below a
  `//---- Private implementation starts here ----` marker: `openDBF`, `createDBF`, `readRecordsFromDBF`,
  `appendRecordsToDBF`. Put new logic in those functions, not in the class.
- Parsing state lives in underscore-prefixed instance fields (`_headerLength`, `_recordLength`, `_recordsRead`,
  `_memoPath`, `_version`, `_encoding`, `_readMode`, `_includeDeletedRecords`). These are effectively private but
  are plain public properties for cross-function access.
- `readRecords` is stateful: `_recordsRead` is a cursor remembered between calls, and the async iterator is just
  a loop over `readRecords(100)`. Any change to the read path must keep the cursor and file position
  (`_headerLength + recordLength * _recordsRead`) in sync.
- No file handle is held open between calls. Every operation opens the fd, works in a `try`, and closes it in a
  `finally`. Reads are chunked through a reusable buffer sized `recordLength * 1000` so very large files stream.

Field encoding/decoding is a single `switch (field.type)` in each direction (read in `readRecordsFromDBF`, write
in `appendRecordsToDBF`). Every case is responsible for advancing `offset` itself — some advance by `field.size`,
others by a trimmed `len`. Adding a field type means touching both switches plus the type union and size rules in
[src/field-descriptor.ts](src/field-descriptor.ts).

Supporting modules:

- [src/field-descriptor.ts](src/field-descriptor.ts) — `FieldDescriptor` and `validateFieldDescriptor`, which is
  where per-type size/decimal limits live (e.g. `C` ≤ 255, `Y`/`D`/`T`/`B` exactly 8, memo size depends on file
  version). Value-level validation on write is separately in `validateRecord` in `dbf-file.ts`; the two must agree.
- [src/file-version.ts](src/file-version.ts) — the `FileVersion` union and `isValidFileVersion`. Versions:
  `0x03` dBase III no memo, `0x83` dBase III + memo, `0x8b` dBase IV + memo, `0x30` VFP9, `0xf5` FoxPro 2.
- [src/options.ts](src/options.ts) — options types plus `normaliseOpenOptions`/`normaliseCreateOptions`, which
  validate and fill defaults. New options get validated there and returned as `Required<...>`.
- [src/utils.ts](src/utils.ts) — promisified `fs` calls and the date conversions (8-char `YYYYMMDD` dates, and
  the Julian-day/ms-since-midnight pair used by VFP `T` fields). All dates are treated as UTC.

### Cross-cutting behaviours to preserve

- **Loose read mode** (`{readMode: 'loose'}`): unknown file versions, unsupported field types, and missing memo
  files must be tolerated rather than throwing. Unsupported fields still appear in `fields` but are omitted from
  record objects. Any new validation added to the read path needs a `if (options.readMode !== 'loose')` guard.
- **Encodings**: an encoding is per-file or per-field; always resolve via `getEncoding(dbf._encoding, field)`
  rather than reading `_encoding` directly. Field *names* in the header are decoded with the default encoding.
- **Memo fields are read-only.** `createDBF` explicitly rejects any `M` field. Memo block size varies by version
  (dBase III fixed 512, dBase IV at .dbt offset 4, FoxPro at .fpt offset 6, and VFP9 block size 1 is a special
  case where each block is sized to its value — see [doc/vfp9-bs1.pdf](doc/vfp9-bs1.pdf)). Memo file paths are
  discovered by extension substitution, trying both lowercase and uppercase.
- **Deleted records**: the leading record byte is `0x2a` for deleted, `0x20` otherwise. They count toward
  `recordCount` but are skipped unless `includeDeletedRecords` is set, in which case they carry `[DELETED]: true`.
- Appending updates the record count at header offset `0x04` and rewrites the `0x1A` EOF marker.

Format references and fixture provenance are collected in [doc/README.md](doc/README.md).
