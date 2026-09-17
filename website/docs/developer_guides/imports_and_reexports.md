---
title: Dependencies and re-exports
description:
  What JBrowse provides as shared libraries (re-exports) versus what your plugin
  bundles itself from npm, and how to import each
guide_category: Core concepts
---

Your plugin runs _inside_ the host JBrowse app, sharing its JavaScript runtime,
so an import resolves one of two ways:

- Re-exports are a fixed set of libraries the host already loaded. Your plugin
  must use the host's copy instead of bundling one.
- Everything else is any other npm package. Your plugin bundles it normally.

Import React, MobX, MST, MUI and every `@jbrowse` package listed below normally
(the plugin template externalizes them to the host's copy); everything else gets
bundled into your plugin.

## Why re-exports exist

Some libraries break if two copies load at once. If your plugin bundled its own
React or MobX, the host's instance and yours would run side by side:

- React - "Invalid hook call" errors and broken context; hooks only work against
  the React instance that rendered the tree.
- mobx / mobx-state-tree - observability and type identity are per-instance. Two
  MobX copies means reactions don't fire across the boundary; two MST copies
  means snapshots, references, and `types` identity don't line up.
- MUI / emotion - theming and style injection rely on a shared context and style
  cache.
- `@jbrowse/core` - pluggable-element base classes, the configuration system,
  and shared model types must be the same objects the host registers against.

So JBrowse loads one copy of each and **re-exports** it to plugins.

## What is re-exported

The list lives in
[`packages/core/src/ReExports/list.ts`](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/ReExports/list.ts),
generated from the packages' own `exports` maps, and the table below is
generated from the same run. The categories:

- Framework singletons - `react` (with `react/jsx-runtime`), `react-dom` (with
  `react-dom/client`), `mobx`, `mobx-react`, and `@jbrowse/mobx-state-tree`, our
  internal MST fork, which is also aliased from plain `mobx-state-tree`.
- Styling - `@mui/material` and its per-component subpaths (e.g.
  `@mui/material/Button`), `@mui/material/styles`, `tss-react`,
  `@mui/x-data-grid`.
- Every `@jbrowse` package the host bundles, at every subpath its `exports` map
  publishes — `@jbrowse/core`, the display layer (`@jbrowse/display-kit`,
  `@jbrowse/render-core`, `@jbrowse/display-ui`), the helper packages, and each
  core plugin's entry (`@jbrowse/plugin-linear-genome-view`, ...). Your editor's
  completion on any of these is the list of what you can import.

A plugin's one bundle is evaluated on the main thread and again in the RPC
worker, where nothing renders. The worker serves an export for real unless the
module that declares it reaches react-dom, a Material UI component, the data
grid or floating-ui, so a helper function a package's barrel re-exports beside
its components is real. Each export that does render is a stub with its name, so
your bundle still evaluates there. The stub is inert — every read and call on it
returns another stub, so a number taken off one is 0 and a list is empty — and
it reports nothing when that happens. The last column says how many of each
package's exports are real; an adapter, an RPC method or a state-model mixin is
always real in both realms.

<!-- REEXPORT_MODULES START -->

<!-- prettier-ignore -->
| Package | What it provides | Subpaths | Real in the RPC worker |
| --- | --- | --- | --- |
| `@jbrowse/add-track-core` | The file-format table the add-track guessers and the CLI both read — no framework deps | 1 | all of it |
| `@jbrowse/alignments-core` | Shared GPU rendering utilities for alignments and synteny displays | 2 | all of it |
| `@jbrowse/app-core` | JBrowse 2 code shared between the 'full featured' apps e.g. jbrowse-web and jbrowse-desktop | 1 | 30 of 36 exports; the rest stubbed |
| [`@jbrowse/cigar-utils`](/docs/api/cigar-utils) | Pure CIGAR / MD / mismatch parsers and types — no rendering or framework deps | 1 | all of it |
| [`@jbrowse/core`](/docs/api/core) | JBrowse 2 core libraries used by plugins | 237 | 1225 of 1325 exports; the rest stubbed |
| `@jbrowse/display-kit` | The display integration layer a track type is built on: the fetch foundations, the byte gate, the display chrome, SVG export, and the RegionHost view contract | 75 | 122 of 147 exports; the rest stubbed |
| [`@jbrowse/display-ui`](/docs/api/display-ui) | The UI a display draws that is not data: the swappable chrome contract, its toolkit-free implementations, and the track overlay layer | 5 | 52 of 58 exports; the rest stubbed |
| `@jbrowse/embedded-core` | JBrowse 2 code shared between embedded products | 1 | 1 of 4 exports; the rest stubbed |
| `@jbrowse/ld-core` | Pure linkage-disequilibrium parsers and math — PLINK .ld parsing and genotype r²/D' — no rendering or framework deps | 1 | all of it |
| [`@jbrowse/modifications-utils`](/docs/api/modifications-utils) | Pure MM/ML base-modification tag parsers (methylation, etc.) | 1 | all of it |
| `@jbrowse/plugin-alignments` | JBrowse 2 alignments adapters, tracks, etc. | 2 | 17 of 24 exports; the rest stubbed |
| `@jbrowse/plugin-arc` | JBrowse 2 arc adapters, tracks, etc. | 1 | none; a stub with its names |
| `@jbrowse/plugin-authentication` | JBrowse 2 Authentication | 1 | none; a stub with its names |
| `@jbrowse/plugin-bed` | JBrowse 2 bed adapters, tracks, etc. | 1 | all of it |
| `@jbrowse/plugin-blat` | JBrowse 2 UCSC BLAT client | 1 | none; a stub with its names |
| `@jbrowse/plugin-breakpoint-split-view` | JBrowse 2 breakpoint detail split view | 1 | none; a stub with its names |
| `@jbrowse/plugin-canvas` | JBrowse 2 plugin for canvas features | 3 | 36 of 39 exports; the rest stubbed |
| `@jbrowse/plugin-circular-view` | JBrowse 2 circular view | 1 | 1 of 3 exports; the rest stubbed |
| `@jbrowse/plugin-comparative-adapters` | JBrowse 2 comparative adapters | 1 | none; a stub with its names |
| `@jbrowse/plugin-config` | JBrowse 2 config utilities | 1 | all of it |
| `@jbrowse/plugin-data-management` | JBrowse 2 linear genome view | 1 | all of it |
| `@jbrowse/plugin-dotplot-view` | JBrowse 2 dotplot view | 1 | 1 of 3 exports; the rest stubbed |
| `@jbrowse/plugin-gccontent` | JBrowse 2 gccontent concepts | 1 | all of it |
| `@jbrowse/plugin-gff3` | JBrowse 2 gff3. | 1 | all of it |
| `@jbrowse/plugin-grid-bookmark` | JBrowse 2 grid bookmark widget | 1 | none; a stub with its names |
| `@jbrowse/plugin-gtf` | JBrowse 2 gtf feature adapter | 1 | all of it |
| `@jbrowse/plugin-gwas` | JBrowse 2 GWAS adapters, tracks, and Manhattan plot displays | 1 | all of it |
| `@jbrowse/plugin-hic` | JBrowse 2 hic adapters, tracks, etc. | 1 | all of it |
| `@jbrowse/plugin-jobs-management` | JBrowse 2 jobs management | 1 | 1 of 2 exports; the rest stubbed |
| `@jbrowse/plugin-legacy-jbrowse` | JBrowse 2 plugin for connecting to and reading JBrowse 1 data | 1 | all of it |
| `@jbrowse/plugin-linear-comparative-view` | JBrowse 2 linear comparative view | 1 | none; a stub with its names |
| `@jbrowse/plugin-linear-genome-view` | JBrowse 2 linear genome view | 1 | 35 of 59 exports; the rest stubbed |
| `@jbrowse/plugin-maf` | JBrowse 2 multiple alignment format (MAF) viewer | 1 | none; a stub with its names |
| `@jbrowse/plugin-marks` | JBrowse 2 config-authored mark display: bars, points and spans drawn from a declared encoding over any feature track | 1 | all of it |
| `@jbrowse/plugin-menus` | JBrowse 2 basic menus | 1 | all of it |
| `@jbrowse/plugin-rdf` | JBrowse 2 RDF resources | 1 | all of it |
| `@jbrowse/plugin-sequence` | JBrowse 2 sequence adapters, tracks, etc. | 1 | all of it |
| `@jbrowse/plugin-spreadsheet-view` | JBrowse 2 spreadsheet view | 1 | all of it |
| `@jbrowse/plugin-sv-inspector` | JBrowse 2 SV inspector view | 1 | none; a stub with its names |
| `@jbrowse/plugin-text-indexing` | JBrowse 2 text indexing rpc method | 1 | all of it |
| `@jbrowse/plugin-trix` | JBrowse 2 trix text search adapter | 1 | all of it |
| `@jbrowse/plugin-variants` | JBrowse 2 variant adapters, tracks, etc. | 1 | all of it |
| `@jbrowse/plugin-wiggle` | JBrowse 2 wiggle adapters, tracks, etc. | 2 | 8 of 9 exports; the rest stubbed |
| `@jbrowse/product-core` | JBrowse 2 code shared between products but not used by plugins | 1 | 63 of 96 exports; the rest stubbed |
| `@jbrowse/render-core` | GPU/Canvas2D rendering primitives for JBrowse displays: the HAL, the draw-lifecycle mixin, per-region/global backend bases, and the React backend hooks | 57 | all of it |
| [`@jbrowse/sv-core`](/docs/api/sv-core) | VCF breakend / structural-variant parsing and the shared SV launch helpers | 1 | 36 of 37 exports; the rest stubbed |
| [`@jbrowse/synteny-core`](/docs/api/synteny-core) | Shared utilities for synteny and dotplot rendering | 1 | 149 of 173 exports; the rest stubbed |
| `@jbrowse/text-indexing` | JBrowse 2 text indexing for desktop | 2 | all of it |
| `@jbrowse/text-indexing-core` | JBrowse 2 core text indexing routines for parsing GFF3 and VCF files | 1 | all of it |
| `@jbrowse/tree-sidebar` | Shared tree sidebar component for multi-sample displays | 9 | 126 of 142 exports; the rest stubbed |
| `@jbrowse/web-core` | JBrowse 2 code shared between web-app type products | 1 | 2 of 7 exports; the rest stubbed |
| [`@jbrowse/wiggle-core`](/docs/api/wiggle-core) | Score-axis scale, autoscale, config mixins and plot chrome shared by wiggle, Manhattan, mark and coverage displays | 7 | 75 of 81 exports; the rest stubbed |

<!-- REEXPORT_MODULES END -->

## What is _not_ re-exported

Anything not in that list (`d3`, `lodash-es`, a file-format parser, your own
helpers): `import` it normally and your bundler includes it in your plugin's
output. Nothing breaks from having more than one copy, so these aren't shared.

A `@jbrowse` subpath the exports map does not publish is not importable at all,
so there is nothing of a served package that a plugin can end up bundling. What
a host can lack is a whole package it does not bundle — the embedded
circular-genome-view build serves fewer plugins than jbrowse-web — and a key a
host lacks throws at the plugin's first read, naming the key, so the failure is
one notification rather than an `undefined is not a function` somewhere later.

## Standalone helper packages

JBrowse publishes several helper packages to npm alongside `@jbrowse/core`, so
the parsing and scale math is already written. The host serves each of them, and
the third column says whether a second copy would also be safe, for a no-build
plugin or one bundling deliberately.

<!-- HELPER_PACKAGES START -->

<!-- prettier-ignore -->
| Package | What it provides | How to use it |
| --- | --- | --- |
| [`@jbrowse/cigar-utils`](/docs/api/cigar-utils) | Pure CIGAR / MD / mismatch parsers and types — no rendering or framework deps | Served by the host, and safe to bundle too — no framework or `@jbrowse/core` dependency |
| [`@jbrowse/modifications-utils`](/docs/api/modifications-utils) | Pure MM/ML base-modification tag parsers (methylation, etc.) | Served by the host, and it has to be: it depends on `@jbrowse/core`, so a bundled second copy would not interoperate. Import it and let the template externalize it |
| [`@jbrowse/wiggle-core`](/docs/api/wiggle-core) | Score-axis scale, autoscale, config mixins and plot chrome shared by wiggle, Manhattan, mark and coverage displays | Served by the host, and it has to be: it depends on `@jbrowse/core`, `@jbrowse/mobx-state-tree`, `mobx-react`, `react`, so a bundled second copy would not interoperate. Import it and let the template externalize it |
| [`@jbrowse/display-ui`](/docs/api/display-ui) | The UI a display draws that is not data: the swappable chrome contract, its toolkit-free implementations, and the track overlay layer | Served by the host, and it has to be: it depends on `@jbrowse/core`, `@jbrowse/mobx-state-tree`, `mobx-react`, `react`, `react-dom`, so a bundled second copy would not interoperate. Import it and let the template externalize it |
| [`@jbrowse/synteny-core`](/docs/api/synteny-core) | Shared utilities for synteny and dotplot rendering | Served by the host, and it has to be: it depends on `@jbrowse/core`, `@jbrowse/mobx-state-tree`, `mobx`, `mobx-react`, `react`, so a bundled second copy would not interoperate. Import it and let the template externalize it |
| [`@jbrowse/sv-core`](/docs/api/sv-core) | VCF breakend / structural-variant parsing and the shared SV launch helpers | Served by the host, and it has to be: it depends on `@jbrowse/core`, `@jbrowse/mobx-state-tree`, `mobx`, `mobx-react`, `react`, `react-dom`, so a bundled second copy would not interoperate. Import it and let the template externalize it |

<!-- HELPER_PACKAGES END -->

A package with no framework dependency is safe to bundle: two copies of a pure
parser are wasteful at worst. One that depends on `@jbrowse/core` or the
React/MobX stack is not — a second copy of core is a second configuration system
and a second set of model types, which the host does not recognize — and that is
why the host serves it.

The exported functions for each are documented on the linked API pages and
mirrored into the package's README on npm.

## How to import, by plugin type

### Build-step plugins (template)

Import everything normally. `LinearScoreDisplay`, from the
[worked example plugin](/docs/developer_guides/plotting_features), imports both
kinds without distinguishing them:

<!-- include: example-plugins/score-example/src/LinearScoreDisplay/model.ts#imports -->

```ts
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getContainingView } from '@jbrowse/core/util'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import StoredHoverMixin from '@jbrowse/display-kit/StoredHoverMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { fetchEachRegion } from '@jbrowse/display-kit/fetchEachRegion'
import { types } from '@jbrowse/mobx-state-tree'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { inkOfInstances } from '@jbrowse/render-core/marks'

import { SCORE_MARKS } from './scoreMarks.ts'
```

The [plugin templates](/docs/developer_guides/simple_plugin) mark the re-export
list as **external**, so every import above resolves to the host's copy at
runtime: the `@jbrowse/core` subpaths, `@jbrowse/display-kit`,
`@jbrowse/render-core`, `@jbrowse/mobx-state-tree`, `mobx`. A dependency that is
not on the list — `d3-scale`, say — is bundled into the plugin. The build
configs read `ReExports/list.ts` directly, so you do not maintain this set
yourself; what it does mean is that a plugin rebuilt against a newer
`@jbrowse/core` externalizes whatever that version's list names, and needs a
host at least that new.

### What your tsconfig needs

`@jbrowse/core` addresses its subpaths through an `exports` map, which
TypeScript reads under `moduleResolution` `bundler`, `node16` or `nodenext`.
Under the older `"node"` setting it reads no `exports` map at all, so every
subpath import fails with `TS2307: Cannot find module '@jbrowse/core/util'` and
a note naming the resolution setting. The published package is intact; the one
line to change is in your own tsconfig:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

Both [plugin templates](/docs/developer_guides/simple_plugin) already set it, so
a plugin started from one never meets this. Leaving `moduleResolution` out
entirely also works, because TypeScript now defaults to `bundler`. The error
reaches you only from a tsconfig naming `"node"` explicitly, which was the
default years ago and which older plugins still carry. TypeScript 6 deprecates
that setting and TypeScript 7 removes it.

### No-build plugins

A [no-build plugin](/docs/developer_guides/no_build_plugin) has no bundler to
externalize anything, so it pulls re-exported modules at runtime with
`pluginManager.jbrequire`:

<!-- include: test_data/no_build_plugin/esmplugin.js#jbrequire -->

<!-- prettier-ignore -->
```js
const { ConfigurationSchema } = pluginManager.jbrequire(
  '@jbrowse/core/configuration',
)
const WidgetType = pluginManager.jbrequire(
  '@jbrowse/core/pluggableElementTypes/WidgetType',
)
const { ElementId } = pluginManager.jbrequire(
  '@jbrowse/core/util/types/mst',
)
const { types } = pluginManager.jbrequire('@jbrowse/mobx-state-tree')

const React = pluginManager.jbrequire('react')
```

`jbrequire` only knows the re-export list. Requesting anything else throws:

```
No jbrequire re-export defined for 'd3-scale'. The host serves what
@jbrowse/core/ReExports/list names: the framework singletons, Material UI, and
every subpath the bundled @jbrowse packages publish. Anything else, bundle into
the plugin.
```

With no bundler, a non-re-exported dependency has to be loaded another way:
inline it into your single file, or switch to a build-step plugin.

## Quick reference

| You need                                   | Build-step plugin                         | No-build plugin                           |
| ------------------------------------------ | ----------------------------------------- | ----------------------------------------- |
| React, MobX, MST, MUI, tss-react           | `import` normally (template externalizes) | `pluginManager.jbrequire('react')`        |
| `@jbrowse/*` packages (in the table above) | `import` from `@jbrowse/...`              | `pluginManager.jbrequire('@jbrowse/...')` |
| Any other npm package                      | `import` normally (gets bundled)          | inline it, or use a build-step plugin     |

## A second copy of `@jbrowse/core` is the failure to avoid {#jbrowsecore-paths-not-in-the-list}

Before the list was generated from the exports maps it named 25 of core's
subpaths, and a build-step plugin importing any other — or importing
`@jbrowse/display-kit`, which reaches 33 of them — bundled a copy of that code
beside the host's. One published plugin carried 84 files of core that way,
including the blob map that carries a locally opened file to the worker and a
React context the host's provider never reaches. Every published subpath is
served now, so a plugin built against the current template cannot do this; a
plugin built against an older list can, and its next rebuild fixes it.

## See also

- [](/docs/developer_guides/simple_plugin)
- [](/docs/developer_guides/no_build_plugin)
- [](/docs/developer_guides/pluggable_elements)
- [PLUGIN_ABI_STABILITY.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/PLUGIN_ABI_STABILITY.md)
  — why a name on this page ossifies once it ships, and what removing one
  actually costs
