---
name: an-index-format-error-names-the-file-and-what-it-found
description: The gmod libraries throw a bare "Not a BAI file" or "invalid .crai index file" naming neither the file nor what they read, so JBrowse's `loadErrorHint` writes the sentence itself. Rewording the throws upstream lets every caller drop it.
---

# An index format error names the file and what it found

`loadErrorHint` (`packages/core/src/ui/loadErrorHint.ts`) turns a wrong-format
index error into a sentence on the track's error bar, because the libraries
say only that the format is wrong. The throw sites:

- `@gmod/bam` 10.3.0: `src/bai.ts:116` `'Not a BAI file'`, `src/csi.ts:100`
  `` `Not a CSI file ${magic}` ``
- `@gmod/tabix` 3.13.1: `src/tbi.ts:72` `'Not a TBI file'`, `src/csi.ts:39`
  `` `Not a CSI file (magic=${magic})` ``
- `@gmod/cram` 14.5.0, `src/craiIndex.ts`: `:128` (already names a `.bai` given
  as a `.crai`), the field-count and empty-field variants at `:156`, `:161` and
  `:171`, and the bare `invalid .crai index file` at `:180`

Each library reads through a filehandle that carries `source` (the URL or
path, undefined for a picked file), so the message can name the file. It can
say what it found from the first bytes:

- a BAI, TBI or CSI magic: another index format
- a gzip header: the data file given as its own index
- `<!DO` or `<htm`: a server's HTML page, usually a login or 404 page
- anything else: the first four bytes in hex

For example: `https://h/x.bam.bai is not a BAI index: a BAI starts with
"BAI\1", this starts with "TBI\1" (a tabix index)`. For CRAI: `x.crai is not a
.crai index: expected tab-separated numbers, found …`.

**What changes with it:** `loadErrorHint` matches `/Not a (BAI|TBI|CSI) file/`
and `invalid .crai index file`. A reworded throw must update that match in the
same JBrowse release that bumps the library, or the class falls through to the
raw message. Once the libraries say it, the wrong-format sentence can leave
`loadErrorHint`, and the Fix file location button keys on the class alone.
