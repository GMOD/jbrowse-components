---
name: blat-moves-to-the-plugin-store
description: "BLAT is bundled in no product and loads from the hub configs that name it; on 2026-11-03 every genomes.jbrowse.org config started naming the dist/v1 bundle built from plugins/blat here. The plugin now lives in GMOD/jbrowse-plugin-blat (~/src/jb2plugins/jbrowse-plugin-blat), CI green. Blocked on Colin's hand first publish to npm; then the store's unlisted entry, jb2hubs switching to the store's latest/ url, and deleting plugins/blat and its publish job here."
---

# BLAT moves to the plugin store

Colin (2026-11-03): BLAT belongs only on UCSC-capable instances such as
genomes.jbrowse.org, and should be fixable without a JBrowse release; aim at the
end state, adding store features as needed. Desktop stops bundling it and its
direct-to-UCSC path goes; the shared proxy budget is fine.

## Live now

- Every UCSC and GenArk `config.json` names
  `https://jbrowse.org/plugins/jbrowse-plugin-blat/dist/v1/jbrowse-plugin-blat.umd.production.min.js`
  (jb2hubs `hubtools/src/enhanceConfig.ts` `defaultPlugins`), published from
  `plugins/blat` here by `plugins/blat/scripts/publish-umd.sh`.
- The proxy (`products/aws/blat-proxy`) enforces a per-caller share, deployed.
- Neither product bundles BLAT (`products/*/src/corePlugins.ts`).

## Next, in order

- **Colin: first npm publish.** In `~/src/jb2plugins/jbrowse-plugin-blat`,
  `pnpm build && npm publish --access public`, then on npmjs.com add the
  trusted publisher (GMOD/jbrowse-plugin-blat, `publish.yml`). Trusted
  publishing cannot create a package (`npm-first-publish-needs-a-human` in
  memory).
- **Store entry.** `~/src/jbrowse-plugin-list/plugins.json`: `name: "Blat"`,
  `packageName: "jbrowse-plugin-blat"`,
  `umdPath: "dist/jbrowse-plugin-blat.umd.production.min.js"`,
  `unlisted: true`, `license: "Apache-2.0"`. Then `pnpm dep`, which is live
  (store `CLAUDE.md` invariant 1); check the `latest/` url serves.
- **jb2hubs.** The Blat entry becomes
  `{ name: 'Blat', storePlugin: 'Blat', url: '<store latestUrl>' }`, like
  Hubs; `./run.sh --configs-only` on ada; `pnpm host-compat` in the plugin repo
  against the regenerated configs.
- **Here.** Delete `plugins/blat`, `.github/workflows/release.yml`'s
  `publishblatumd` job, the `@jbrowse/plugin-blat` workspace entry, and the
  plugin's lines in `agent-docs/reference/HOSTING.md`; point
  `website/docs/user_guides/blat.md` at the store's `latest/` url; leave
  `dist/v1/` on S3 for configs already published. `desktop-blat-steps.png`,
  `desktop-ispcr.png` and `desktop-ispcr-results.png` show the old dialog's
  apiKey field and need a reshoot (`products/jbrowse-desktop/test/screenshots.ts`).

## Decided

- Not bundled into jbrowse-web: BLAT does nothing off a UCSC-hosted assembly,
  and a bundled copy can only be fixed by a release.
- Proxy only, on Desktop too: the direct path was the one Desktop API the
  plugin needed, and the proxy's per-caller share and slot waits cover the
  capacity it was for.
