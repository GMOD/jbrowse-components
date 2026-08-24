---
title: Dependencies and re-exports
description:
  What JBrowse provides as shared libraries (re-exports) versus what your plugin
  bundles itself from npm, and how to import each
guide_category: Core concepts
---

Your plugin runs _inside_ the host JBrowse app, sharing its JavaScript runtime.
So "where does this import come from?" has two answers:

- Re-exports are a fixed set of libraries the host already loaded. Your plugin
  must use the host's copy, not bundle its own.
- Everything else is any other npm package. Your plugin bundles it normally.

**TL;DR:** Import React, MobX, MST, MUI, and the `@jbrowse/core` APIs listed
below normally (the plugin template externalizes them to the host's copy);
everything else gets bundled into your plugin.

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

The canonical list lives in
[`packages/core/src/ReExports/list.ts`](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/ReExports/list.ts),
and the table below is generated from it. The categories:

- Framework singletons - `react` (with `react/jsx-runtime`), `react-dom` (with
  `react-dom/client`), `mobx`, `mobx-react`, and `@jbrowse/mobx-state-tree`, our
  internal MST fork, which is also aliased from plain `mobx-state-tree`.
- Styling - `@mui/material` and its per-component subpaths (e.g.
  `@mui/material/Button`), `@mui/material/styles`, `tss-react`,
  `@mui/x-data-grid`. The legacy `@material-ui/core` paths are aliased to the
  same MUI v5 modules for backward compatibility, and are derived from the same
  subpath list rather than maintained separately.
- `@jbrowse/core` APIs - the building blocks for pluggable elements and shared
  helpers:

<!-- REEXPORT_MODULES START -->

<!-- prettier-ignore -->
| Module | What it provides |
| --- | --- |
| `@jbrowse/core/Plugin` | The base `Plugin` class your plugin extends |
| `@jbrowse/core/pluggableElementTypes` | `ViewType`, `AdapterType`, `DisplayType`, `TrackType`, `WidgetType` in one import, for the `install` method that registers several |
| `@jbrowse/core/pluggableElementTypes/ViewType` | Just the `ViewType` class, registered with `addViewType` |
| `@jbrowse/core/pluggableElementTypes/AdapterType` | Just the `AdapterType` class, registered with `addAdapterType` |
| `@jbrowse/core/pluggableElementTypes/DisplayType` | Just the `DisplayType` class, registered with `addDisplayType` |
| `@jbrowse/core/pluggableElementTypes/TrackType` | Just the `TrackType` class, registered with `addTrackType` |
| `@jbrowse/core/pluggableElementTypes/WidgetType` | Just the `WidgetType` class, registered with `addWidgetType` |
| `@jbrowse/core/pluggableElementTypes/models` | Base MST models for tracks and displays to compose with |
| `@jbrowse/core/configuration` | `ConfigurationSchema`, `ConfigurationReference`, `readConfObject`, `getConf` |
| `@jbrowse/core/util/types/mst` | Reusable MST types like `ElementId` and `Region` |
| `@jbrowse/core/ui` | Shared UI components — dialogs, menus, error and loading states |
| `@jbrowse/core/ui/theme` | The JBrowse MUI theme |
| `@jbrowse/core/ui/palette` | The same colors and `resolvePalette` without Material UI in the module graph, for worker and renderer code |
| `@jbrowse/core/ui/BaseTooltip` | The hover tooltip, kept out of the `ui` barrel so @floating-ui stays off the startup path |
| `@jbrowse/core/util` | Core helpers: `getSession`, `getContainingView`, `Feature`, region and coordinate utilities |
| `@jbrowse/core/util/color` | Color parsing and manipulation helpers |
| `@jbrowse/core/util/layouts` | Feature layout (packing) helpers |
| `@jbrowse/core/util/tracks` | Track and adapter config helpers |
| `@jbrowse/core/util/Base1DViewModel` | The 1D (bp↔px) view model the linear views are built on |
| `@jbrowse/core/util/io` | `openLocation` and the file-handle helpers |
| `@jbrowse/core/util/mst-reflection` | Helpers for inspecting MST types |
| `@jbrowse/core/util/rxjs` | The RxJS re-exports an adapter's `getFeatures` stream is built from |
| `@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail` | `FeatureDetails`, `BaseCard` and the other feature-detail building blocks |
| `@jbrowse/core/data_adapters/BaseAdapter` | `BaseFeatureDataAdapter` and the adapter base classes |
| `@jbrowse/core/data_adapters/dataAdapterCache` | `getAdapter`, the worker-side adapter cache an RPC method resolves its adapter through |

<!-- REEXPORT_MODULES END -->

## What is _not_ re-exported

Anything not in that list (`d3`, `lodash-es`, a file-format parser, your own
helpers): `import` it normally and your bundler includes it in your plugin's
output. Nothing breaks from having more than one copy, so these aren't shared.

## Standalone helper packages

JBrowse publishes several helper packages to npm alongside `@jbrowse/core`, so
the parsing and scale math is already written. None of them is re-exported, and
the third column says what each costs to depend on.

<!-- HELPER_PACKAGES START -->

<!-- prettier-ignore -->
| Package | What it provides | How to use it |
| --- | --- | --- |
| [`@jbrowse/cigar-utils`](/docs/api/cigar-utils) | Pure CIGAR / MD / mismatch parsers and types — no rendering or framework deps | No framework or `@jbrowse/core` dependency — `npm install` and import it like any other dependency (it gets bundled) |
| [`@jbrowse/modifications-utils`](/docs/api/modifications-utils) | Pure MM/ML base-modification tag parsers (methylation, etc.) | Depends on `@jbrowse/core` — those resolve to the host's copy, so import it from a build-step plugin that externalizes them |
| [`@jbrowse/wiggle-core`](/docs/api/wiggle-core) | Shared scale and autoscale utilities for wiggle and coverage displays | Depends on `@jbrowse/core`, `@jbrowse/mobx-state-tree`, `mobx-react`, `react` — those resolve to the host's copy, so import it from a build-step plugin that externalizes them |
| [`@jbrowse/display-ui`](/docs/api/display-ui) | The UI a display draws that is not data: the swappable chrome contract, its toolkit-free implementations, and the track overlay layer | Depends on `@jbrowse/core`, `@jbrowse/mobx-state-tree`, `mobx-react`, `react`, `react-dom` — those resolve to the host's copy, so import it from a build-step plugin that externalizes them |
| [`@jbrowse/synteny-core`](/docs/api/synteny-core) | Shared utilities for synteny and dotplot rendering | Depends on `@jbrowse/core`, `@jbrowse/mobx-state-tree`, `mobx`, `mobx-react`, `react` — those resolve to the host's copy, so import it from a build-step plugin that externalizes them |
| [`@jbrowse/sv-core`](/docs/api/sv-core) | VCF breakend / structural-variant parsing and the shared SV launch helpers | Depends on `@jbrowse/core`, `@jbrowse/mobx-state-tree`, `mobx`, `mobx-react`, `react`, `react-dom` — those resolve to the host's copy, so import it from a build-step plugin that externalizes them |

<!-- HELPER_PACKAGES END -->

A package with no framework dependency is safe to bundle: two copies of a pure
parser are wasteful at worst. One that depends on `@jbrowse/core` or the
React/MobX stack is not, for the reason in
[`@jbrowse/core` paths not in the list](#jbrowsecore-paths-not-in-the-list)
below — bundling a second copy of core gives you a second configuration system
and a second set of model types, which the host does not recognize. Import those
from a build-step plugin, whose template externalizes the shared set.

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
import MultiRegionDisplayMixin, {
  fetchEachRegion,
} from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { types } from '@jbrowse/mobx-state-tree'
import { installPerRegionLifecycle } from '@jbrowse/render-core/installPerRegionLifecycle'
import { observable } from 'mobx'
```

The [plugin templates](/docs/developer_guides/simple_plugin) mark the re-export
list as **external**, so every import above that appears in the table earlier on
this page resolves to the host's copy at runtime: the `@jbrowse/core` subpaths,
`@jbrowse/mobx-state-tree`, `mobx`. The other two,
`@jbrowse/plugin-linear-genome-view` and `@jbrowse/render-core`, are not on the
list, so they are bundled into the plugin, which is what happens to any
dependency that isn't — `d3-scale`, say. The build configs read
`ReExports/list.ts` directly, so you do not maintain this set yourself.

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
No jbrequire re-export defined for package 'd3-scale'. If this package must be
shared between plugins, add it to ReExports/list.ts. If it does not need to be
shared, just import it normally.
```

With no bundler, a non-re-exported dependency has to be loaded another way:
inline it into your single file, or switch to a build-step plugin.

## Quick reference

| You need                                 | Build-step plugin                         | No-build plugin                                |
| ---------------------------------------- | ----------------------------------------- | ---------------------------------------------- |
| React, MobX, MST, MUI, tss-react         | `import` normally (template externalizes) | `pluginManager.jbrequire('react')`             |
| `@jbrowse/core` APIs (in the list above) | `import` from `@jbrowse/core/...`         | `pluginManager.jbrequire('@jbrowse/core/...')` |
| Any other npm package                    | `import` normally (gets bundled)          | inline it, or use a build-step plugin          |

## Importing an unlisted `@jbrowse/core` path {#jbrowsecore-paths-not-in-the-list}

`@jbrowse/core` exports far more than the re-exported subset. With a build step
you _can_ import a core path that isn't re-exported, but the bundler copies that
code into your plugin rather than sharing the host's. That's harmless for pure
helpers, but risky for anything depending on shared identity or singletons
(model types, registries, the configuration system), since you'd get two
diverging copies. If you need such a module shared,
[open a request](https://github.com/GMOD/jbrowse-components/discussions/new) to
add it to the list.

## See also

- [](/docs/developer_guides/simple_plugin)
- [](/docs/developer_guides/no_build_plugin)
- [](/docs/developer_guides/pluggable_elements)
- [PLUGIN_ABI_STABILITY.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/PLUGIN_ABI_STABILITY.md)
  — why a name on this page ossifies once it ships, and what removing one
  actually costs
