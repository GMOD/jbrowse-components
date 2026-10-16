---
name: split-chunks-and-hashless-chunk-names-for-jbrowse-web
description: jbrowse-web's worker downloads its own copy of the vendor modules (chunk 62604, 53 KB gz, 96% already inside main.js). `splitChunks: { chunks: 'all' }` saves 39-41 KB gz on every page with no change to worker parse, and chunk filenames without per-chunk hashes save another 11-12 KB. Measured 2026-10-08 on a stale build; re-measure first.
---

# `splitChunks` and hashless chunk names for jbrowse-web

Sizes are gzip -9, page plus worker, a chunk both realms fetch counted once. The
audited build was 288 commits behind main, so **re-measure before trusting any
figure**.

| page | gz |
| --- | ---: |
| empty, no plugin named | 695 KB |
| four tracks (BAM, wiggle, GFF, VCF) | 1132 KB |
| empty, one runtime plugin named | 1017 KB |

`pnpm measure-web-bundle`'s "emptyLGV" is the third row, since the volvox config
names `umd_plugin.js`. The script needs `--no-sandbox` to launch Chrome on the
dev box.

## 1. `splitChunks: { chunks: 'all' }`

- Built and measured: 39-41 KB gz on every page, worker parse unchanged (1198 KB
  raw both ways), timing unchanged.
- An earlier revert counted the page's CDP requests alone, which cannot see
  worker requests (`cdpNetwork.ts` says so).
- Web only: desktop shares the base config in
  `config/webpack/config/webpack.config.ts`.
- Gate: `browser-tests/worker-smoke.ts` and the e2e suite in CI.
- `main.js` was 124 KB gz with mobx inside after `1e57f5c68a` moved mobx out and
  reached 97 KB; this change moves mobx out again.

## 2. Chunk filenames without per-chunk hashes

- 11-12 KB gz: the id-to-hash map sits in `main.js` and again in the worker
  entry.
- Try `chunkFilename: 'static/js/[fullhash]/[id].chunk.js'`.
- Cost: a returning user refetches chunks a deploy did not change. `push.yml`'s
  30-day prune still works.
