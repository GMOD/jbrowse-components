---
title: Dependencies and re-exports
description:
  What JBrowse provides as shared libraries (re-exports) versus what your plugin
  bundles itself from npm, and how to import each
guide_category: Core concepts
---

Your plugin runs _inside_ the host JBrowse app, sharing its JavaScript runtime.
That makes "where does this import come from?" a real question with two answers:

- Re-exports are a fixed set of libraries the host already loaded. Your plugin
  must use the host's copy, not bundle its own.
- Everything else is any other npm package. Your plugin bundles it normally.

## Why re-exports exist

Some libraries break if two copies are loaded at once. If your plugin bundled
its own React or MobX, you'd have the host's instance _and_ yours running side
by side, which causes:

- React - "Invalid hook call" errors and broken context; hooks only work against
  the React instance that rendered the tree.
- mobx / mobx-state-tree - observability and type identity are per-instance. Two
  MobX copies means reactions don't fire across the boundary; two MST copies
  means snapshots, references, and `types` identity don't line up.
- MUI / emotion - theming and style injection rely on a shared context and style
  cache.
- `@jbrowse/core` - pluggable-element base classes, the configuration system,
  and shared model types must be the same objects the host registers against.

So JBrowse loads one copy of each and **re-exports** it to plugins. Your plugin
reaches for the host's instance instead of bundling its own.

## What is re-exported

The canonical list lives in
[`packages/core/src/ReExports/list.ts`](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/ReExports/list.ts).
It changes over time, so treat that file as the source of truth. The categories:

- Framework singletons - `react`, `react-dom`, `mobx`, `mobx-react`,
  `@jbrowse/mobx-state-tree` (our internal MST fork).
- Styling - `@mui/material` and its per-component subpaths (e.g.
  `@mui/material/Button`), `@mui/material/styles`, `tss-react`,
  `@mui/x-data-grid`. The legacy `@material-ui/core` paths are aliased to the
  same MUI v5 modules for backward compatibility.
- `@jbrowse/core` APIs - the building blocks for pluggable elements and shared
  helpers:

  | Module                                              | What it provides                                                                              |
  | --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
  | `@jbrowse/core/Plugin`                              | The base `Plugin` class your plugin extends                                                   |
  | `@jbrowse/core/pluggableElementTypes`               | `ViewType`, `AdapterType`, `DisplayType`, `TrackType`, `WidgetType` (registered in `install`) |
  | `@jbrowse/core/pluggableElementTypes/models`        | Base MST models for tracks/displays to compose with                                           |
  | `@jbrowse/core/configuration`                       | `ConfigurationSchema`, `ConfigurationReference`, `readConfObject`, `getConf`                  |
  | `@jbrowse/core/util`                                | Core helpers: `getSession`, `getContainingView`, `Feature`, region/coordinate utilities       |
  | `@jbrowse/core/util/types/mst`                      | Reusable MST types like `ElementId`, `Region`                                                 |
  | `@jbrowse/core/util/color`                          | Color parsing/manipulation helpers                                                            |
  | `@jbrowse/core/util/layouts`                        | Feature layout (packing) helpers                                                              |
  | `@jbrowse/core/util/tracks`                         | Track/adapter config helpers                                                                  |
  | `@jbrowse/core/util/io`                             | `openLocation` and file-handle helpers                                                        |
  | `@jbrowse/core/util/rxjs`                           | RxJS re-exports used by adapter `getFeatures` streams                                         |
  | `@jbrowse/core/util/Base1DViewModel`                | The 1D (bp↔px) view model used by linear views                                                |
  | `@jbrowse/core/util/mst-reflection`                 | Helpers for inspecting MST types                                                              |
  | `@jbrowse/core/ui`                                  | Shared UI components (dialogs, menus, error/loading states)                                   |
  | `@jbrowse/core/ui/theme`                            | The JBrowse MUI theme                                                                         |
  | `@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail` | `FeatureDetails`, `BaseCard` and other feature-detail building blocks                         |
  | `@jbrowse/core/data_adapters/BaseAdapter`           | `BaseFeatureDataAdapter` and adapter base classes                                             |

## What is _not_ re-exported

Anything not in that list: `d3`, `lodash-es`, a file-format parser, your own
helpers, and so on. There's nothing special to do: `import` it normally and your
bundler includes it in your plugin's output. These don't need to be shared
because nothing breaks from having more than one copy.

## Standalone helper packages

JBrowse publishes several **framework-free utility packages** to npm. They have
no React/MobX/`@jbrowse/core` dependency, so they aren't re-exported. You
`npm install` and `import` them like any other dependency (they get bundled).
Reach for these instead of re-implementing the parsing/scale math yourself:

| Package                        | What it provides                                         |
| ------------------------------ | -------------------------------------------------------- |
| `@jbrowse/cigar-utils`         | CIGAR / MD / mismatch parsers and types                  |
| `@jbrowse/modifications-utils` | MM/ML base-modification (methylation) tag parsers        |
| `@jbrowse/wiggle-core`         | Score scale, normalization, and autoscale-domain helpers |
| `@jbrowse/synteny-core`        | Synteny/dotplot color and coordinate helpers             |
| `@jbrowse/sv-core`             | VCF breakend / structural-variant parsing helpers        |

The exported functions for each are documented in the API reference
([cigar-utils](/docs/api/cigar-utils),
[modifications-utils](/docs/api/modifications-utils),
[wiggle-core](/docs/api/wiggle-core), [synteny-core](/docs/api/synteny-core),
[sv-core](/docs/api/sv-core)) and mirrored into each package's README on npm.

## How to import, by plugin type

### Build-step plugins (template)

Import everything normally, including re-exports:

```ts
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'
import Button from '@mui/material/Button'
import { scaleLinear } from 'd3-scale' // not re-exported → bundled
```

The [plugin templates](/docs/developer_guides/simple_plugin) wire up their
bundler to mark the re-export list as **external**, so re-exported imports
resolve to the host's copy at runtime instead of being bundled, while
non-re-exported imports (like `d3-scale` above) are bundled into your plugin.
The build configs read `ReExports/list.ts` directly to get this set, so you
don't maintain it yourself.

### No-build plugins

A [no-build plugin](/docs/developer_guides/no_build_plugin) has no bundler to
externalize anything, so it pulls re-exported modules at runtime with
`pluginManager.jbrequire`:

```js
const { ConfigurationSchema } = pluginManager.jbrequire(
  '@jbrowse/core/configuration',
)
const { types } = pluginManager.jbrequire('@jbrowse/mobx-state-tree')
const React = pluginManager.jbrequire('react')
```

`jbrequire` only knows the re-export list. Requesting anything else throws:

```
No jbrequire re-export defined for package 'd3-scale'. If this package must be
shared between plugins, add it to ReExports. If it does not need to be shared,
just import it normally.
```

In a no-build plugin you can't bundle, so a non-re-exported dependency has to be
loaded another way (inline it into your single file, or switch to a build-step
plugin).

## Quick reference

| You need                                 | Build-step plugin                         | No-build plugin                                |
| ---------------------------------------- | ----------------------------------------- | ---------------------------------------------- |
| React, MobX, MST, MUI, tss-react         | `import` normally (template externalizes) | `pluginManager.jbrequire('react')`             |
| `@jbrowse/core` APIs (in the list above) | `import` from `@jbrowse/core/...`         | `pluginManager.jbrequire('@jbrowse/core/...')` |
| Any other npm package                    | `import` normally (gets bundled)          | inline it, or use a build-step plugin          |

## A note on `@jbrowse/core` paths not in the list

`@jbrowse/core` exports far more than the re-exported subset. With a build step
you _can_ import a core path that isn't re-exported, but the bundler copies that
code into your plugin rather than sharing the host's. That's harmless for pure
helpers, but risky for anything that depends on shared identity or singletons
(model types, registries, the configuration system), because you'd end up with
two diverging copies. If you need such a module shared and it isn't re-exported,
[open a request](https://github.com/GMOD/jbrowse-components/discussions/new) to
have it added to the list.

## See also

- [Writing a plugin](/docs/developer_guides/simple_plugin)
- [Writing a no-build plugin](/docs/developer_guides/no_build_plugin)
- [Pluggable elements](/docs/developer_guides/pluggable_elements)
