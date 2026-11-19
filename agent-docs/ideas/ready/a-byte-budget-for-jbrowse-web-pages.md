---
name: a-byte-budget-for-jbrowse-web-pages
description: "Nothing gates what a jbrowse-web page downloads: the examples site ratchets its pages, jbrowse-web's empty and four-track volvox pages are not. A ratchet on `measure-web-bundle --worker` would have caught a one-constant move that cost 31 KB gzipped on track pages."
---

# A byte budget for jbrowse-web pages

`eagerBundleSizes.json` and `eagerFloor.json` ratchet the build-your-own
examples site. jbrowse-web, the product most users load, has no gate.

- **The miss it would have caught:** moving `DEFAULT_MARK_COLOR` off
  `markEncoding` took 11 KB gzipped off the empty volvox page and added 31 KB to
  four tracks, because webpack re-split the chunks around it
  ([lazy-rpc-method-bodies](lazy-rpc-method-bodies.md)). Only the second page
  showed it.
- **Spelling:** bank `measure-web-bundle --worker`'s two totals (emptyLGV,
  fourTracks; page plus worker realm) in a JSON beside `eagerBundleSizes.json`,
  and fail on a rise past a few KB. Print the packages that moved, as the
  examples-site check does.
- **Where it runs:** it needs a production build, so beside whatever CI job
  already builds jbrowse-web, not in `verify`.
- **Noise:** chunk hashes change the id-to-hash map in `main.js`, so allow a
  1-2 KB band rather than an exact match.

Baseline, measured 2026-11-19 on `cc7fae0f32` plus the writeUniforms loop:
emptyLGV 755 KB, fourTracks 1317 KB gzipped.
