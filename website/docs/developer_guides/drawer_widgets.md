---
id: drawer_widgets
title: Drawer Widgets in Embedded Components
description: Extensible system for launching sidebar or popup widgets
guide_category: Creating pluggable elements
---

## Overview

Drawer widgets provide a flexible UI pattern for displaying supplementary panels
in the embedded `@jbrowse/react-linear-genome-view2` component. Instead of modal
dialogs, widgets can be displayed as resizable side panels (drawers) that
integrate seamlessly with the genome view.

This feature is particularly useful for deployments with sufficient screen real
estate where a persistent side panel improves the user experience compared to
modal dialogs.

## Feature Capabilities

Drawer widgets support:

- **Resizable panels** — drag the edge to adjust width
- **Flexible positioning** — switch between left and right side placement
- **Minimizable state** — hide the drawer while maintaining widget state
- **Widget switching** — navigate between multiple open widgets
- **Clean integration** — drawers respect responsive layout constraints

## Using Drawer Widgets

### Automatic Track Selector

The most common use case is showing a hierarchical track selector panel. Use the
`init` field with `tracklist: true`:

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
        assembly: 'hg38', // Required: assembly name
        tracklist: true, // Shows track selector in drawer
      },
    },
  },
})

export default function App() {
  return <JBrowseLinearGenomeView viewState={state} />
}
```

### Programmatic Widget Management

For more advanced scenarios, you can manage widgets programmatically:

```javascript
// Open a widget in the drawer
const editor = state.session.addWidget(
  'ConfigurationEditorWidget',
  'configEditor',
  {},
)
state.session.showWidget(editor)

// Switch drawer position
state.session.setDrawerPosition('left')

// Minimize/show drawer
state.session.minimizeWidgetDrawer()
state.session.showWidgetDrawer()

// Close a widget
state.session.hideWidget(editor)
```

## Configuration Options

### Init State

The `init` field accepts the following options:

```typescript
interface InitState {
  assembly: string // Required: assembly name
  tracklist?: boolean // Show hierarchical track selector (default: false)
  loc?: string // Initial location (e.g., 'chr1:1000..2000')
  tracks?: TrackInit[] // Tracks to display
  nav?: boolean // Show navigation header (default: true)
  highlight?: string[] // Genomic regions to highlight
}
```

### Drawer Positioning

Control drawer appearance through session actions:

```javascript
// Drawer width (CSS pixels, default: 384, clamped to a min/max)
state.session.updateDrawerWidth(500)

// Drawer position (default: 'right')
state.session.setDrawerPosition('left') // or 'right'

// Drawer visibility
state.session.showWidgetDrawer()
state.session.minimizeWidgetDrawer()
```

## Session Storage

The drawer position is automatically persisted to localStorage and restored on
the next page load:

```javascript
state.session.drawerPosition // Persisted across reloads
```

## Responsive Behavior

Drawers adjust to available container width:

- Minimum drawer width: 128px
- Minimum main view width: 150px
- Width constraints prevent drawers from taking the entire viewport

## Keyboard Controls

Users can interact with drawer widgets using:

- **Menu button (⋮)** — switch drawer position
- **Minimize button (−)** — hide drawer
- **Close button (✕)** — close widget
- **Widget selector dropdown** — navigate between open widgets

## Example: Custom Widget Integration

To display a custom widget in the drawer:

```javascript
// Assuming you've registered a custom widget type
const myWidget = state.session.addWidget('MyCustomWidget', 'myWidgetId', {
  /* initial state */
})

// Make it visible in the drawer
state.session.showWidget(myWidget)

// User can now interact with it in the drawer panel
```

## Browser Compatibility

Drawer widgets work in all modern browsers supporting:

- CSS Grid layout
- CSS custom properties (variables)
- localStorage API

## Performance Considerations

- **Lazy loading** — widgets are lazily loaded via React Suspense
- **Resize debouncing** — resize operations are efficiently throttled
- **Observable state** — drawer state changes trigger efficient re-renders

## Storybook Example

View the `WithDrawerWidget` example in the JBrowse Storybook to see drawer
widgets in action:

https://jbrowse.org/storybook/lgv/main/?path=/story/source-code-for-examples--with-drawer-widget
