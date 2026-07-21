---
title: Custom view types
description: Add entirely new view panels such as DotplotView or CircularView
guide_category: Creating pluggable elements
---

View types are top-level "panels" that the session can contain alongside the
built-in `LinearGenomeView`, `DotplotView`, `CircularView`, `SpreadsheetView`,
and others. A view defines its own state model and React component, and it does
not have to display genomic tracks, though most do.

## When to add a custom view type

Add a view type when you need a panel with its own layout, state, and toolbar
that does not fit inside an existing view. Examples in the wild:

- `jbrowse-plugin-msaview` adds a multiple sequence alignment view that has no
  underlying tracks at all
- `DotplotView` and `LinearSyntenyView` host synteny tracks but with their own
  axis and layout logic

If you only need to render features differently inside the linear genome view,
[a custom display type](/docs/developer_guides/creating_display) is the right
abstraction instead.

## Minimal walkthrough

The [plugin templates](/docs/developer_guides/simple_plugin) give you a complete
scaffold and build setup to register a view via
`pluginManager.addViewType(...)`. Start there.

A view registration looks roughly like:

```ts
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { types } from '@jbrowse/mobx-state-tree'
import { stateModelFactory, ReactComponent } from './MyView'

export default function (pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'MyView',
      stateModel: stateModelFactory(pluginManager),
      ReactComponent,
    })
  })
}
```

The state model is a [mobx-state-tree](https://mobx-state-tree.js.org/) model
(see [MST patterns](/docs/developer_guides/mst_patterns)) and the React
component receives `{ model }` as a prop.

## Reference implementations in this repo

- `plugins/linear-genome-view/src/LinearGenomeView` - the canonical genomic
  view, with displayed regions, blocks, and a track container
- `plugins/dotplot-view/src/DotplotView` - independent X/Y axes hosting synteny
  tracks
- `plugins/spreadsheet-view/src/SpreadsheetView` - non-genomic tabular view
- `plugins/circular-view/src/CircularView` - radial layout with chord tracks

Read these alongside the simple plugin tutorial when designing your own.

## See also

- [Custom track and display types](/docs/developer_guides/creating_display)
- [Extension points](/docs/developer_guides/extension_points)
- [MST patterns](/docs/developer_guides/mst_patterns)
- [Pluggable elements](/docs/developer_guides/pluggable_elements)
