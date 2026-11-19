---
name: hashless-chunk-names-for-jbrowse-web
description: "Chunk filenames without per-chunk hashes would take 12 KB gzipped off every jbrowse-web page, since the id-to-hash map ships in `main.js` and again in the worker entry; the cost is that a returning user refetches every chunk after a deploy."
---

# Hashless chunk names for jbrowse-web

- **Saving:** 12 KB gzipped on every page, measured 2026-11-18 with
  `pnpm measure-web-bundle --worker` on top of `splitChunks: { chunks: 'all' }`
  (1087 to 1075 KB on the empty volvox page, 1497 to 1485 KB with four tracks).
  The id-to-hash map sits in `main.js` and again in the worker entry.
- **Spelling:** `chunkFilename: 'static/js/[fullhash]/[id].chunk.js'` in
  `products/jbrowse-web/scripts/config.ts`, production only. The build, the
  worker and `prune-s3-chunks` handle the subdirectory.
- **Cost:** every deploy moves every chunk, so a returning user refetches
  chunks the deploy did not change. `code/jb2/main` redeploys on each push to
  main.
- **Time:** level with hashed names in the same probe as the split-chunks
  change (EAGER_BUNDLE.md).
