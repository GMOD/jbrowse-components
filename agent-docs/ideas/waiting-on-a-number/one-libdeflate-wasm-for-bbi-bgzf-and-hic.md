---
name: one-libdeflate-wasm-for-bbi-bgzf-and-hic
description: "@gmod/bbi, bgzf-filehandle and inflate (hic) each inline their own libdeflater wasm, about 22 KB gzipped apiece, so a page with a BigWig and a BAM fetches two. One shared wasm saves one per extra format; waits on the merged module's size."
---

# One libdeflate wasm for bbi, bgzf and hic

The three crates are libdeflater with near-identical release profiles; they
differ only in the functions they export: `inflate_raw_batch` plus
BigWig/summary parsing in bbi, `decompress_all` and `decompress_chunk_slice` in
bgzf, `inflate_raw*` in inflate-js. Each inlined bundle is 21-24 KB gzipped.

## The number it waits on

Build one crate exporting all three sets and measure its inlined bundle. If it
stays near 25 KB gzipped, a page with two of the formats saves about 20 KB; if
the parsers make it much larger, a page with one format pays for the others.

## What it costs

- A shared package (`@gmod/inflate` already exists) that bbi and bgzf depend on,
  with releases of all three, then bam, tabix and indexedfasta.
- wasm-bindgen glue names carry build hashes, so every consumer must resolve one
  copy of the shared package; two versions in a lockfile bring two wasms back.
- Per `~/src/gmod/agent-docs/wasm-bundles.md`, the Rust repos' bytes depend on
  the build machine's clang, and each repo's `check:wasm` stamp moves with it.
