DBFFile
=======

Read and write .dbf files in Node.js:

- Supports `C` (string) , `N` (numeric) , `L` (logical) and `D` (date) field types
- Can open an existing .dbf file
  - Can access all field descriptors
  - Can access total record count
  - Reading records is ***not*** yet supported
- Can create a new .dbf file
  - Can use field descriptors from a hash of from another instance
- Can append records to an existing .dbf file
  - Supports very large files
- All operations are asyncronous and return a promise
