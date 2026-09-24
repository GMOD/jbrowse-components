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

Import React, MobX, MST, MUI and the `@jbrowse` packages listed below normally
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
- `@jbrowse/core` and the display toolkit (`@jbrowse/display-kit`,
  `@jbrowse/render-core`, `@jbrowse/display-ui`), at every subpath their
  `exports` maps publish. Your editor's completion on these is the list of what
  you can import.

No other `@jbrowse` package is re-exported. A helper package such as
`@jbrowse/cigar-utils` gets bundled into your plugin like any npm dependency,
and another plugin's package (`@jbrowse/plugin-linear-genome-view`, ...) is not
something a plugin imports at runtime: bundling one gives your plugin a second
copy of that plugin's models.

A plugin's one bundle is evaluated on the main thread and again in the RPC
worker, where nothing renders. The worker serves a module for real unless the
module reaches react-dom, a Material UI component, the data grid or floating-ui,
in which case it serves a stub that carries the module's export names, so your
bundle still evaluates there. The stub is inert — every read and call on it
returns another stub, so a number taken off one is 0 and a list is empty — and
it reports nothing when that happens. Anything the worker has to compute belongs
on a subpath the worker serves for real. The last column says how much of each
package that is; an adapter, an RPC method or a state-model mixin is always real
in both realms.

<!-- REEXPORT_MODULES START -->

<!-- prettier-ignore -->
| Package | What it provides | Subpaths | Real in the RPC worker |
| --- | --- | --- | --- |
| [`@jbrowse/core`](/docs/api/core) | JBrowse 2 core libraries used by plugins | 252 | 213 of 252 subpaths; the rest stubbed |
| `@jbrowse/display-kit` | The display integration layer a track type is built on: the fetch foundations, the byte gate, the display chrome, SVG export, and the RegionHost view contract | 82 | 62 of 82 subpaths; the rest stubbed |
| [`@jbrowse/display-ui`](/docs/api/display-ui) | The UI a display draws that is not data: the swappable chrome contract, its toolkit-free implementations, and the track overlay layer | 5 | 3 of 5 subpaths; the rest stubbed |
| `@jbrowse/render-core` | GPU/Canvas2D rendering primitives for JBrowse displays: the HAL, the draw-lifecycle mixin, per-region/global backend bases, and the React backend hooks | 61 | all of it |

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

```text
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
