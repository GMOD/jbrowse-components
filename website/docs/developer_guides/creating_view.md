---
title: Custom view types
description: Add entirely new view panels such as DotplotView or CircularView
guide_category: Plugins
---

**TL;DR:** View types are top-level "panels" the session can contain alongside
built-ins like `LinearGenomeView`, `DotplotView`, and `CircularView`. A view
defines its own state model and React component; displaying genomic tracks is
optional.

## When to add a custom view type

Add a view type when you need a panel with its own layout, state, and toolbar
that does not fit inside an existing view. Examples:

- `jbrowse-plugin-msaview` adds a multiple sequence alignment view that has no
  underlying tracks at all
- `DotplotView` and `LinearSyntenyView` host synteny tracks but with their own
  axis and layout logic

To render features differently inside the linear genome view, use
[a custom display type](/docs/developer_guides/creating_display).

## Minimal walkthrough

The [plugin templates](/docs/developer_guides/simple_plugin) scaffold the build
setup to register a view via `pluginManager.addViewType(...)`. Every built-in
view is registered the same way — this is the dotplot's, in full:

<!-- include: plugins/dotplot-view/src/DotplotView/index.ts -->

```ts
import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function DotplotViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'DotplotView',
      displayName: 'Dotplot view',
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazy(() => import('./components/DotplotView.tsx')),
    })
  })
}
```

`ViewType` takes four core options:

- **`name`** — what a session snapshot and a URL spec store.
- **`displayName`** — what the view launcher's dropdown shows.
- **`stateModel`** — a [mobx-state-tree](https://mobx-state-tree.js.org/) model,
  see [](/docs/developer_guides/mst_patterns).
- **`ReactComponent`** — receives `{ model }` as a prop. Wrap it in `React.lazy`
  as every built-in view does, so the view's whole component tree stays out of
  the initial bundle until a session opens one.

`ViewType` takes two more options:

- **`extendedName`** names another view type whose displays yours should also
  accept. Display types register against exactly one view type, so a subtype of
  `LinearGenomeView` needs this to pick up the displays every track already has:
  `addViewType` collects the displays matching your `name` _or_ your
  `extendedName`.
- **`viewMetadata: { hiddenFromGUI: true }`** keeps the type out of the view
  launcher's dropdown, for a view that only ever arrives from a spec, a
  connection, or another view's action.

## Making the view launchable from a session spec

Registering the view type is what lets a session snapshot _restore_ one. Opening
one from a URL is separate: `loadSessionSpec` dispatches on the spec's `type` to
a `LaunchView-<name>` extension point, and a view type with no registered point
cannot be launched from a spec; the error names the view type.

Register one to make yours launchable, exporting the args interface and
augmenting `ExtensionPointRegistry` beside it. The spreadsheet view's launcher
is the worked example, under
[TypeScript types for extension points](/docs/developer_guides/extension_points#typescript-types-for-extension-points);
[the LaunchView points](/docs/developer_guides/extension_points#launchview-points)
covers what the launcher is handed and which spec keys never reach it.

## Reference implementations in this repo

- `plugins/linear-genome-view/src/LinearGenomeView` - the canonical genomic
  view, with displayed regions, blocks, and a track container
- `plugins/dotplot-view/src/DotplotView` - independent X/Y axes hosting synteny
  tracks
- `plugins/spreadsheet-view/src/SpreadsheetView` - non-genomic tabular view
- `plugins/circular-view/src/CircularView` - radial layout with chord tracks

## See also

- [](/docs/developer_guides/creating_display)
- [](/docs/developer_guides/extension_points)
- [](/docs/developer_guides/mst_patterns)
- [](/docs/developer_guides/pluggable_elements)
- [VIEW_INIT.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/VIEW_INIT.md)
  — the launch state machine under the session spec above, and where
  `afterAttach` sits in it
- [REGION_VIEW_LAUNCH.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/REGION_VIEW_LAUNCH.md)
  — the convention for opening another view type on a locus, where the two
  existing launchers diverge, and what is still open
