---
name: jbrowse-web-bundle-audit
description: A 2026-10-08 audit of what jbrowse-web fetches on first load found two webpack config changes (about 51 KB gz), pre-compressed Brotli-11 from the deploy (65-97 KB gz), and three smaller code changes, none started. Waiting on a call about the CloudFront change and on a fresh-build re-measure. Read before proposing a bundle cut, since the rarely-used-plugin family and the core utility tidy are already measured as not worth it.
---

# jbrowse-web bundle audit

Two Opus agents reviewed the audit on 2026-10-08. All sizes are gzip -9, page
plus worker, a chunk both realms fetch counted once. **Re-measure on a fresh
build before trusting any figure**: the audited build was 288 commits behind
main.

| page | gz |
| --- | ---: |
| empty, no plugin named | 695 KB |
| four tracks (BAM, wiggle, GFF, VCF) | 1132 KB |
| empty, one runtime plugin named | 1017 KB |

`pnpm measure-web-bundle`'s "emptyLGV" is the third row, since the volvox config
names `umd_plugin.js`. The script also needs `--no-sandbox` to launch Chrome on
this box.

## Next, by saving

1. **`splitChunks: { chunks: 'all' }`**, 39-41 KB gz on every page. Built and
   measured, with no change to worker parse (1198 KB raw both ways) or timing.
   The worker downloads its own copy of the vendor modules (chunk 62604, 53 KB gz,
   96% already inside `main.js`). `products/jbrowse-web/CLAUDE.md` records the
   setting as reverted for an unchanged initial payload; that measurement used the
   page's CDP session, which cannot see worker requests (`cdpNetwork.ts` says so).
   Fix the CLAUDE.md note with the change. Web only: desktop shares the base
   config. Gate with `browser-tests/worker-smoke.ts` and the e2e suite in CI.
2. **Chunk filenames without per-chunk hashes**, 11-12 KB gz. The id-to-hash map
   sits in `main.js` and again in the worker entry. Try
   `chunkFilename: 'static/js/[fullhash]/[id].chunk.js'`. Cost: a returning user
   refetches chunks a deploy did not change. `push.yml`'s 30-day prune still
   works.
3. **Brotli-11 from the deploy**, 65 KB (empty) to 97 KB (four tracks). The
   jbrowse.org distribution (`E13LGELJOT4GQO`) already serves Brotli through its
   cache policy at roughly quality 5, so the gain is quality 5 to 11 (`main.js`
   121.0 KB to 108.5 KB), not Brotli over gzip. Needs: a compress step in the
   S3 deploys of `push.yml` and `release.yml`; `.br` objects uploaded with
   `Content-Encoding: br`, content type and the immutable cache header (`aws s3
   sync` sets no per-file encoding); a CloudFront Function that rewrites to the
   `.br` key when `Accept-Encoding` includes `br`. The Function and the
   distribution update are production config and need a call first. Test on the
   per-branch S3 path with `curl` under `br`, `gzip` and no header, then Firefox.
   The CloudFront side is untested.
4. **Lazy RPC method bodies**, 20 KB (empty) and 13 KB (four tracks), about 2 KB
   with a plugin named, since the registry namespace-imports `featureTransforms`,
   `markEncoding` and `flatbush`. Give `CoreGetEncodedLayers`,
   `CoreGetEncodedFeature`, `MarkScanPlotFields`, `GetConsensusSequence` and
   `MafGetSequences` a `preload()` body like `RenderAlignmentData`. Move `matedBy`
   into its own module. Split `plugins/wiggle/src/util.ts` so its constants and
   `getFilename` stop importing `markEncoding`. Add
   `rpcMethods: ['CoreGetEncodedLayers']` to `LinearMarkDisplay` and
   `MultiWaySyntenyDisplay`, or the first fetch waits an extra round trip.
5. **Uniform writes as loops** in the `writeUniforms` emitter in
   `packages/shader-tools/src/shader-codegen`, about 11 KB on a page with an
   alignments track and about 9 KB with a plugin named.
   `linkMark.iface.generated.ts` unrolls 1,535 assignments. Loop above about 16
   elements so `codegen.test.ts` still passes; a microbench shows the loop at
   2.5 µs against 3.0 µs per call. Check `pnpm gen:shaders`'s exit code.
6. **Strip config-slot `description` strings**, about 12 KB, low priority. The
   saving needs plot-example and adapter descriptions stripped too, and "Edit
   plot" reads those. `jb.describeSlots` is synchronous and desktop's MCP shares
   `jbApi`. jest never runs the babel pass, so a key mismatch drops helper text
   silently.

## Waiting on a call

**A plugin-aware re-export registry**, up to about 307 KB gz on pages naming a
runtime plugin (a plugin page pays 322 KB over a bare one). ADR-128 rejected a
lazy registry because the bundle does not carry what it reads. A UMD bundle does
carry literal `JBrowseExports["@jbrowse/core/util"]` strings (checked on the
protein3d bundle), so the host could scan the plugin's text and load only the
named modules, falling back to the whole registry on any non-literal access or
`jbrequire`. Prototype first and measure.

## Measured and not worth it

- The 15 rarely-used plugins on demand: 26 KB at most, 12 more chunks, silent
  pruning of a missing type by `pruneUnbuildableNodes`, and lost menu entries and
  extension points. Their registration is already lazy; only 1-5 KB each is
  eager by accident.
- Core utility tidy (`util/index.ts`, `geneticCodes`, `crypto`): about 6 KB, and
  `crypto` decrypts share links on the boot path.
- Lazy WebGPU and WebGL2 HAL classes: 0-6 KB for a round trip before the first
  GPU frame.
- Terser with three passes and unsafe options: about 3 KB.
- Deferring `mapStackTrace` (8 KB, only on plugin pages) is safe and small.
- `unzip`/bgzf/pako (28 KB): most sessions load zipped data.
- Menu code (24.6 KB) needs async menu items, a plugin-facing API change.
- Duplicate packages (`react-is` 16 and 19, about 2 KB) and mobx/MST tree-shaking
  (the registry namespace-imports both) leave nothing to recover.

`main.js` is back at 124 KB gz with mobx inside it, after 1e57f5c68a moved mobx
out and reached 97 KB. Item 1 moves mobx out of `main.js` again.
