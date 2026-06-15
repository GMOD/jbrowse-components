# Storybook → Astro examples migration

## Status

**POC validated (2026-06-15).** This directory (`examples-site/`) is a working,
isolated Astro project with one live example (`WithInit`). It proves the
approach end-to-end:

- `pnpm dev` renders the real `@jbrowse/react-linear-genome-view2` component
  (tracks load, canvas draws, RPC worker runs) as a `client:only="react"`
  island.
- `pnpm build` produces a static `dist/` with the configured
  `base: '/storybook/lgv'` correctly baked into asset URLs.

Everything below this point is **not done yet** — it's the plan for continuing
the migration.

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
