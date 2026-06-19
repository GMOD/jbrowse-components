# Storybook → Astro examples migration

## Status

**LGV migration complete (2026-06-18).** All 41 LGV stories are now live Astro
pages. `pnpm build` produces a static `dist/` (42 pages incl. index) with
`base: '/storybook/lgv'` baked in, and a browser smoke test (Puppeteer, headless
Chrome) confirms **40/41 examples render with no console/page errors**.

Structure:

- `src/examples/<Name>.tsx` — one self-contained, default-exported example per
  story (public API only). The displayed source _is_ this file.
- `src/pages/<slug>.astro` — a ~10-line page per example: imports the component
  + its `?raw` source, looks up title/description in the registry, renders via
  the shared layout.
- `src/examples.ts` — single source of truth (slug/name/title/description/group)
  driving the gallery index and each page's metadata.
- `src/layouts/ExampleLayout.astro` — shared chrome (live demo + `<Code>` source).
- `src/pages/index.astro` — grouped gallery linking every example.

Known issue — **`with-web-worker`** is the one example that does not render. The
RPC worker (imported via Vite's `?worker`) bundles the whole JBrowse worker
graph, and under Rollup's strict ESM that graph hits a circular-dependency
init-order error (`Cannot access TextSearchManager before initialization`).
Webpack's CJS interop tolerates the same cycle, which is why the published
package's webpack-built worker is fine. This is a real Rollup-vs-webpack
difference, not a config typo (disabling minification did not change it — the
error survives with the unminified symbol name). Resolving it means either
breaking the core circular dependency or shipping the worker as a prebuilt
classic asset; left as a follow-up.

Convention changes made during the migration:

- **GWAS is now a core plugin** of `@jbrowse/react-linear-genome-view2`
  (`src/corePlugins.ts`), joining Variants. The LocusZoom/Pan-UKB GWAS examples
  therefore need no runtime plugin loading.
- Several inline volvox URLs in the old `source.code` strings were **broken**
  (`jbrowse.org/genomes/volvox/volvox.sort.gff3.gz` 404s) — they were never
  load-tested because the old live render used local `test_data/`. Fixed to the
  working `jbrowse.org/code/jb2/main/test_data/volvox/` paths. The `Managed`
  examples also needed `refNameAliases` added (the hg38 prefix FASTA uses
  non-`chr` refnames).

Everything below this point is the original plan / remaining work (CGV +
react-app sites, CI, removal of old Storybook).

## Why

The old per-package Storybook setups (`.storybook/` in `packages/core`,
`products/jbrowse-react-{linear,circular}-genome-view`,
`products/jbrowse-react-app`) hardcode GitHub source links that are now stale,
and Storybook itself is confusing to maintain (3 separate webpack configs,
addon-docs, CI build+deploy steps). The replacement: a small, hand-written Astro
site **per package**, deployed to the _same URLs_ people already have linked
(`jbrowse.org/storybook/lgv/`, `/storybook/cgv/`, `/storybook/app/`), kept
isolated from the main `website/` Astro project so neither becomes more
monolithic.

## The validated pattern (single source of truth)

Each example is **one file**: `src/examples/<Name>.tsx`, a self-contained
component using only the public API of the published package (same constraint
the old `stories/CLAUDE.md` placed on `source.code` strings — no importing
internal helpers like `getVolvoxConfig`).

A page imports that file twice:

```astro
---
import Example from '../examples/<Name>.tsx'
import exampleSource from '../examples/<Name>.tsx?raw'
---
<Example client:only="react" />
<Code code={exampleSource} lang="tsx" />
```

This eliminates the old dual-maintenance problem (a `*Render` function plus a
hand-written, manually-kept-in-sync `source.code` string) — the displayed source
_is_ the running file, and the "view source" link is just a link to this file in
the repo (which will actually resolve, unlike the old broken GitHub links).

Reference files from the POC:

- `src/examples/WithInit.tsx` — the example
- `src/pages/index.astro` — renders it + its source
- `astro.config.mjs` — `base: '/storybook/lgv'`, `@astrojs/react` integration
- `package.json` — `@jbrowse/react-linear-genome-view2: workspace:*`
- registered in root `pnpm-workspace.yaml` via `'products/*/examples-site'`

## Open decisions before scaling up

1. **Routing**: one Astro page per example (`src/pages/<kebab-name>.astro`,
   file-based routing gives clean URLs) plus an `index.astro` that links to all
   of them — recommended over one giant page with many islands (avoids every
   example's worker/RPC spinning up on every page load).

2. **Per-ref deploys**: CI currently deploys Storybook to
   `s3://jbrowse.org/storybook/lgv/${REF_NAME}/` (versioned per branch/tag — see
   `.github/workflows/push.yml` ~line 292-335). The POC's `base` is the fixed
   string `/storybook/lgv`. Decide: parametrize `base` per build via env var
   (`ASTRO_BASE=/storybook/lgv/${REF_NAME} astro build`), or only ever deploy a
   single stable path (e.g. `main`) for these example sites since "prop
   combinations per version" isn't a goal anymore. The fixed-base POC config
   supports the latter without changes.

3. **CGV and react-app** each need their own `examples-site/` mirroring this one
   (`products/jbrowse-react-circular-genome-view/examples-site/`,
   `products/jbrowse-react-app/examples-site/`), with `base: '/storybook/cgv'` /
   `'/storybook/app'` respectively and their own workspace dependency
   (`@jbrowse/react-circular-genome-view2`, `@jbrowse/react-app2` — verify exact
   published names).

## Inventory to migrate

Counts are _unique story exports_ (verified via
`grep -oP '^export const \K\w+' <file> | sort -u`); each needs review — some may
be droppable, some may merge.

**LGV** (`products/jbrowse-react-linear-genome-view/stories/`) — 41 total:

- `JBrowseLinearGenomeView.stories.tsx` (34): WithInit, DefaultSession,
  DisableAddTrack, ExternalNavigateLocstring, ExternalNavigateObject,
  HorizontallyFlippedViaLocstring, HorizontallyFlippedViaButton,
  HumanExomeExample, ShadowDOMOneLinearGenomeView, UsingLocObject,
  WithAggregateTextSearching, WithCustomTheme, WithDarkTheme,
  WithJexlFeatureColorsAndLabels, WithTrackColorShorthand,
  WithDisableZoomAndSideScroll, WithDrawerWidget, WithErrorHandler,
  WithExternalPlugin, WithInitAdvanced, WithSessionHighlights,
  WithInitAlignmentsDisplay, WithGroupByTag, WithMultiSampleVariantDisplay,
  WithInlinePlugins, WithInternetAccounts, WithMultipleDisplayedRegionsFlipped,
  WithObserveVisibleFeatures, WithObserveVisibleRegions, WithOutsideStyling,
  WithPerTrackTextSearching, WithShowTrack, WithTwoLinearGenomeViews,
  WithWebWorker
- `ManagedLinearGenomeView.stories.tsx`: Managed
- `ManagedLinearGenomeViewImperativeEscape.stories.tsx`:
  ManagedWithImperativeEscape
- `stories/examples/` barrel (5): LocusZoomLD, NextstrainCovid,
  OneLinearGenomeView, PanUKBGWAS, UseCreateViewState

**react-app** (`products/jbrowse-react-app/stories/`) — 18 total:

- `JBrowseReactApp.stories.tsx` (17): BasicExample, HumanDemo,
  WithImportConfigJson, WithFetchConfigJson, DarkTheme, SyntenyExample,
  WithLaunchLinearGenomeView, DotplotExample, CircularExample,
  SpreadsheetExample, SvInspectorExample, BreakpointSplitExample,
  AddTracksProgrammatically, EmbeddedPlugin, WithWebWorker, WithOnChange,
  WithExternalPlugin
- `ManagedJBrowse.stories.tsx`: Managed

**CGV** (`products/jbrowse-react-circular-genome-view/stories/`) — 4 total:

- `JBrowseCircularGenomeView.stories.tsx` (3): Volvox, ShowTrack, Human
- `ManagedCircularGenomeView.stories.tsx`: Managed

`packages/core/stories/JBrowseCore.stories.tsx` (9 lines) — check if this has
any real content or is a stub; likely droppable.

## Verification

No `playwright`/`chromium-cli` available in this sandbox. Use
`@jbrowse/browser-test-utils` (Puppeteer) instead — it already has
`findChromeExecutable`, `BASE_CHROME_ARGS`, `isBrowserConsoleNoise`,
`waitForLoadingComplete`, `waitForDisplaysDone`
(`packages/browser-test-utils/src/`). Write a throwaway script importing those
via relative path (`./src/browser.ts` etc. — package self-import doesn't
resolve), run with `node --experimental-strip-types <script>.mjs` from inside
`packages/browser-test-utils/`, and delete it afterward.

## Removal checklist (do last, once examples-site replaces each package)

- `.storybook/` dirs in `packages/core`, `products/jbrowse-react-app`,
  `products/jbrowse-react-{linear,circular}-genome-view`
- `stories/` dirs in those same packages
- `storybook`/`@storybook/*` deps from root `package.json` and each package's
  `package.json`, plus `storybook`/`storybook:build` scripts
- CI: `.github/workflows/push.yml` ~line 292-335 (LGV/app/CGV storybook
  build+deploy) — replace with `examples-site` build+deploy
- Docs links: `website/docs/tutorials/embed_linear_genome_view.md` (links to
  `jbrowse.org/storybook/lgv/main/`), `website/docs/embedded_components.md`
