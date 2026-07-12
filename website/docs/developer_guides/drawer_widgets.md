---
title: Drawer widgets
description: Launching sidebar or popup widgets in the embedded LGV
guide_category: Creating pluggable elements
---

## Overview

In the embedded `@jbrowse/react-linear-genome-view2` component, widgets can be
shown as resizable side panels (drawers) instead of modal dialogs. A drawer is a
persistent panel suited to layouts with room for one alongside the genome view.

Drawers can be resized by dragging the edge, placed on the left or right,
minimized while keeping widget state, and switched between when several widgets
are open.

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

Control the drawer through session actions:

```javascript
// drawer width (CSS pixels, default: 384, clamped to a min/max)
state.session.updateDrawerWidth(500)

// drawer position (default: 'right')
state.session.setDrawerPosition('left') // or 'right'

// drawer visibility
state.session.showWidgetDrawer()
state.session.minimizeWidgetDrawer()
```

`drawerPosition` is persisted to localStorage and restored on the next page
load. Width is clamped so the drawer cannot take the entire viewport (minimum
drawer width 128px, minimum main view width 150px).

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

See the `WithDrawerWidget` example in the JBrowse examples site:

https://jbrowse.org/storybook/lgv/with-drawer-widget/

## See also

- [Creating custom widgets](/docs/developer_guides/creating_widget) - how to
  register the widget type shown in a drawer
- [Extension points](/docs/developer_guides/extension_points) -
  `Core-replaceWidget` and `Core-extraFeaturePanel` customize widget contents
- [Embedded components](/docs/embedded_components) - drawer widgets are specific
  to `@jbrowse/react-linear-genome-view2`
