---
title: Drawer widgets
description: Launching sidebar or popup widgets in the embedded LGV
guide_category: Plugins
---

## Overview

In the embedded `@jbrowse/react-linear-genome-view2` component, widgets can show
as resizable side panels (drawers) instead of modal dialogs.

**TL;DR:** Set `tracklist: true` in the view `init` for the track selector, or
call `session.addWidget(...)` + `session.showWidget(...)` for any widget. Drawer
position and width are controlled via session actions.

Drawers resize by dragging the edge, sit on the left or right, minimize while
keeping widget state, and switch between open widgets.

## Showing the track selector

The most common use is a hierarchical track selector panel. Set
`tracklist: true` in the view's `init`:

```javascript
import {
  createViewState,
  JBrowseLinearGenomeView,
} from '@jbrowse/react-linear-genome-view2'

const state = createViewState({
  assembly: assemblyConfig,
  tracks: tracksConfig,
  location: 'chr1:1000..2000',
  defaultSession: {
    name: 'My Session',
    view: {
      id: 'linearGenomeView',
      type: 'LinearGenomeView',
      init: {
        assembly: 'hg38', // required: assembly name
        tracklist: true, // shows track selector in drawer
      },
    },
  },
})

export default function App() {
  return <JBrowseLinearGenomeView viewState={state} />
}
```

## Managing widgets programmatically

```javascript
// open a widget in the drawer
const editor = state.session.addWidget(
  'ConfigurationEditorWidget',
  'configEditor',
  {},
)
state.session.showWidget(editor)

// switch drawer position
state.session.setDrawerPosition('left')

// minimize/show drawer
state.session.minimizeWidgetDrawer()
state.session.showWidgetDrawer()

// close a widget
state.session.hideWidget(editor)
```

## Init state options

The `init` field accepts:

```typescript
interface InitState {
  assembly: string // required: assembly name
  tracklist?: boolean // show hierarchical track selector (default: false)
  loc?: string // initial location (e.g., 'chr1:1000..2000')
  tracks?: TrackInit[] // tracks to display
  nav?: boolean // show navigation header (default: true)
  highlight?: (string | HighlightType)[] // genomic regions to highlight
  showCenterLine?: boolean // show the center line
  trackLabels?: 'overlapping' | 'offset' | 'hidden' // track-label placement mode
  colorByCDS?: boolean // color CDS by reading frame + draw amino acid lettering
}
```

## Drawer position and width

Width (CSS pixels, default 384) is set with `updateDrawerWidth(500)`, clamped so
the drawer cannot take the whole viewport (minimum drawer width 128px, minimum
main view width 150px). `drawerPosition` (default `'right'`, set with
`setDrawerPosition`) persists to localStorage and restores on the next page
load.

## Showing a custom widget

```javascript
// assuming you've registered a custom widget type
const myWidget = state.session.addWidget('MyCustomWidget', 'myWidgetId', {
  /* initial state */
})

state.session.showWidget(myWidget)
```

Widgets are lazily loaded via React Suspense, so a custom widget's code is only
fetched when it first opens.

## Storybook example

See the `WithDrawerWidget` example:
https://jbrowse.org/storybook/lgv/with-drawer-widget/

## See also

- [Creating custom widgets](/docs/developer_guides/creating_widget)
- [](/docs/developer_guides/extension_points)
- [](/docs/embedded_components)
