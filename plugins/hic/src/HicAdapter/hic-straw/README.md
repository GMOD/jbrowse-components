# hic-straw (vendored)

This directory is a vendored TypeScript port of **hic-straw** by the IGV team,
adapted from:

https://github.com/igvteam/hic-straw/

Original license: MIT (Copyright the Regents of the University of California /
Broad Institute). See the upstream repository for the full license text.

## Why it's vendored

`hic-straw` ships untyped JavaScript, which broke type-checking in downstream
package builds (e.g. `@jbrowse/img`), and has seen upstream churn. Vendoring it
as typed TypeScript removes the untyped dependency and pins the behavior.

## What was changed from upstream

This is a lean port that keeps only what the JBrowse `HicAdapter` uses:

- Accepts only a JBrowse filehandle (`{ read(position, length) }`); the remote
  IO layer (`RemoteFile`/`ThrottledFile`/`RateLimiter`/`BrowserLocalFile`) and
  the deprecated local-`path` input were dropped.
- Inflation uses `pako-esm2` instead of the bundled `zlib_and_gzip.js`.
- Removed the legacy normalization-vector-index lookup table (`nvi.js`), the
  orphan `polygons.js`, the unused `DynamicBlockIndex`, and FRAG-site code.
- All sources converted to TypeScript.

The on-disk `.hic` parsing logic is otherwise faithful to upstream; output was
verified byte-identical against the npm package (see `verify.test.ts`).
