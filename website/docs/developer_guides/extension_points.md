---
title: Extension points
description: Callbacks registered by producers and consumed across the app
guide_category: Core concepts
---

## What are extension points?

Extension points let plugin developers register callbacks that are invoked at
specific places in the application.

## Using extension points

The basic API is that producers can say:

```typescript
const ret = pluginManager.evaluateExtensionPoint('ExtensionPointName', {
  value: 1,
})
```

And consumers can say (here two separate callbacks register against the same
point, e.g. from two different plugins):

```typescript
// first consumer
pluginManager.addToExtensionPoint(
  'ExtensionPointName',
  (arg: { value: number }) => {
    return { value: arg.value + 1 }
  },
)

// second consumer
pluginManager.addToExtensionPoint(
  'ExtensionPointName',
  (arg: { value: number }) => {
    return { value: arg.value + 1 }
  },
)
```

Each registered callback receives the return value of the previous one as its
argument (chained). In the example above, the producer passes `{value:1}`, the
first consumer returns `{value:2}`, the second returns `{value:3}`, so `ret`
would be `{value:3}`.

## TypeScript types for extension points

All built-in extension points are registered in the `ExtensionPointRegistry`
interface in `@jbrowse/core/PluginManager`. The overloads of
`addToExtensionPoint` / `evaluateExtensionPoint` / `evaluateAsyncExtensionPoint`
automatically narrow to the registered types when you pass a known name, so
callbacks get typed `args` and evaluate calls return the correct type without a
cast.

If you create your own extension point, register it the same way:

```typescript
import type PluginManager from '@jbrowse/core/PluginManager'

export interface MyPluginExtensionArgs {
  value: number
}

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'MyPlugin-myExtensionPoint': {
      args: MyPluginExtensionArgs
      result: MyPluginExtensionArgs
    }
  }
}
```

Put the `declare module` block in any file that is part of your plugin's
compilation. Plugins that register a callback get typed `args`; callers of
`evaluateExtensionPoint` get the typed result without a cast.

## API description of extension points

### Evaluation API

```typescript
// extra props are optional, can pass an extra context object your extension
// point receives
pluginManager.evaluateExtensionPoint(extensionPointName, args, props)
```

`args` are accumulated (each callback's return value becomes the next callback's
`args`), while `props` is passed through unchanged.

There is also an async version:

```typescript
// extra props are optional, can pass an extra context object your extension
// point receives
pluginManager.evaluateAsyncExtensionPoint(extensionPointName, args, props)
```

### Registration API

```typescript
pluginManager.addToExtensionPoint(extensionPointName, args => {
  /* do something */
  return newArgs // returned value is passed as args to the next registered callback
})
```

`addToExtensionPoint` creates the extension point if it doesn't exist yet. The
returned value becomes the `args` for the next callback in the chain.

## Current listing of extension points used in codebase

The table below is an at-a-glance index of every extension point registered in
the codebase. It is generated from the `#extensionPoint` tags at each point's
fire/registration site, so it lists every tagged point; the detailed sections
that follow are hand-written.

<!-- EXTENSION_POINTS_INDEX START -->

<!-- prettier-ignore -->
| Extension point | Type | Description |
| --- | --- | --- |
| `Core-addTrackComponent` | sync | Inject a custom React component into a track's rendering area |
| `Core-customizeAbout` | sync | Transform the config shown in a track's About dialog |
| `Core-extendPluggableElement` | sync | Mutate any pluggable element after it is created |
| `Core-extendSession` | sync | Extend the session model with extra state or actions |
| `Core-extendWorker` | sync | Register extra RPC methods on the web worker |
| `Core-extraAboutPanel` | sync | Add extra panels to a track's About dialog |
| `Core-extraFeaturePanel` | sync | Add extra panels to the feature details widget |
| `Core-extraTrackMenuItems` | sync | Add items to a single track's menu |
| `Core-guessAdapterForLocation` | sync | Guess an adapter config from a file location |
| `Core-guessTrackTypeForLocation` | sync | Guess a track type from a file location |
| `Core-handleUnrecognizedAssembly` | sync | Supply an assembly config when a referenced assembly is unknown |
| `Core-preferencesDialogPanels` | sync | Add panels to the preferences dialog |
| `Core-preProcessTrackConfig` | sync | Rewrite a track config snapshot before it is instantiated |
| `Core-replaceAbout` | sync | Replace or wrap a track's About dialog body |
| `Core-replaceWidget` | sync | Replace or wrap the component that renders a widget |
| `DotplotView-ImportFormSyntenyOptions` | sync | Add options to the dotplot view import form |
| `DotplotView-OverlayHTMLComponent` | sync | Add an HTML overlay component to the dotplot view |
| `DotplotView-OverlaySVGComponent` | sync | Add an SVG overlay component to the dotplot view |
| `DotplotView-SyntenyFileFormats` | sync | Add synteny file formats to the dotplot import form |
| `LaunchView-BreakpointSplitView` | async | Programmatically launch a breakpoint split view |
| `LaunchView-CircularView` | async | Programmatically launch a circular view |
| `LaunchView-DotplotView` | async | Programmatically launch a dotplot view |
| `LaunchView-LinearGenomeView` | async | Programmatically launch a linear genome view |
| `LaunchView-LinearSyntenyView` | async | Programmatically launch a linear synteny view |
| `LaunchView-SpreadsheetView` | async | Programmatically launch a spreadsheet view |
| `LaunchView-SvInspectorView` | async | Programmatically launch the SV inspector view |
| `LinearGenomeView-HighlightSVGComponent` | sync | Add an SVG highlight overlay in the LGV SVG export |
| `LinearGenomeView-OverviewScalebarComponent` | sync | Add a component to the overview scalebar |
| `LinearGenomeView-ScalebarHighlightComponent` | sync | Add a highlight component to the scalebar |
| `LinearGenomeView-searchResultSelected` | async | Invoked when a search result is selected |
| `LinearGenomeView-TracksContainerComponent` | sync | Add a component into the LGV tracks container |
| `LinearSyntenyView-ImportFormSyntenyOptions` | sync | Add options to the linear synteny view import form |
| `LinearSyntenyView-SyntenyFileFormats` | sync | Add synteny file formats to the linear synteny import form |
| `TrackSelector-folderDialog` | sync | Replace the dialog shown when a folder category is clicked |
| `TrackSelector-multiTrackMenuItems` | sync | Add items to the multi-track (shopping cart) menu |

<!-- EXTENSION_POINTS_INDEX END -->

The detailed reference for the core extension points follows.

### Core-extendPluggableElement

type: synchronous

- `args` - `PluggableElementType` - the pluggable element being installed
- `props` - none

Used to add extra functionality to e.g. state tree models, for example extra
right-click context menus. Your callback receives every pluggable element
registered to the system. See [Adding menus](/docs/developer_guides/menus) for a
worked example that uses this point to add track context-menu items.

https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/DotplotReadVsRef/index.ts#L12-L45

### Core-guessAdapterForLocation

type: synchronous

- `args` - adapter config

Used to infer an adapter type given a location type from the "Add track"
workflow. You will receive a callback asking if you can provide an adapter
config given a location object. See the
[add track workflow guide](/docs/developer_guides/creating_addtrack_workflow)
for how this fits into adding tracks.

https://github.com/GMOD/jbrowse-components/blob/main/plugins/gff3/src/index.ts#L27-L53

### Core-guessTrackTypeForLocation

type: synchronous

- `args` - `FileLocation` object

Used to infer a track type given a location type from the "Add track" workflow.

Example:
https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/index.ts#L108-L118

### Core-extendSession

type: synchronous

Used to extend the session model itself with new features.

- `args` - `AbstractSessionModel` - instance of the session model

### Core-replaceAbout

type: synchronous

Adds an option to provide a different component for the "About this track"
dialog.

- `args` - a `ReactComponent`, by default the AboutTrack dialog
- `props` - an argument of the format below

```typescript
interface props {
  session: AbstractSessionModel
  config: AnyConfigurationModel
}
```

Example: returns a new about track dialog for a particular track

```typescript
pluginManager.addToExtensionPoint(
  'Core-replaceAbout',
  (DefaultAboutComponent, { session, config }) => {
    return config.trackId === 'volvox.inv.vcf'
      ? NewAboutComponent
      : DefaultAboutComponent
  },
)
```

### Core-extraAboutPanel

type: synchronous

Adds an extra panel to the "About this track" dialog. Return a React component
that renders its own card chrome (use `BaseCard` for a titled section); it is
rendered below the built-in Configuration/Metadata cards. The default renders
nothing.

- `args` - a `ReactComponent`, by default a no-op that renders nothing
- `props` - the object below, also passed to your component

```typescript
interface props {
  session: AbstractSessionModel
  config: AnyConfigurationModel
}
```

Return value: the React component to render. It receives the `props` above.

Example: adds an extra about dialog panel for a particular track ID

```tsx
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'

pluginManager.addToExtensionPoint(
  'Core-extraAboutPanel',
  (DefaultPanel, { config }) => {
    return config.trackId !== 'volvox_sv_test'
      ? DefaultPanel
      : function ExtraAboutPanel({ config }) {
          return <BaseCard title="More info">{/* your content */}</BaseCard>
        }
  },
)
```

:::note

This extension point previously returned a `{ name, Component }` descriptor and
the dialog supplied the titled card. It now returns a bare React component that
renders its own chrome (matching `Core-replaceAbout` / `Core-replaceWidget`).
Wrap your content in `BaseCard` to keep the old titled-section look.

:::

### Core-customizeAbout

type: synchronous

Lets you transform the config snapshot shown in the "About this track" dialog,
after any `formatAbout` config has already been applied.

- `args` - an object of the form `{ config: Record<string, unknown> }`, the
  track config snapshot with `formatAbout` already merged in
- `props` - an object of the form below

```typescript
interface props {
  session: AbstractSessionModel
  config: AnyConfigurationModel
}
```

Return value: an object of the same `{ config }` shape, with your modifications

Example: add a derived field to a particular track's about dialog

```typescript
pluginManager.addToExtensionPoint('Core-customizeAbout', (arg, { config }) => {
  return config.trackId === 'volvox.inv.vcf'
    ? { config: { ...arg.config, 'Custom field': 'Custom value' } }
    : arg
})
```

### Core-replaceWidget

type: synchronous

Adds an option to provide a different component for a given widget, drawer, or
modal.

- `args` - a `ReactComponent`
- `props` - an object of the type below

```typescript
import type { ReplaceWidgetProps } from '@jbrowse/core/PluginManager'
// ReplaceWidgetProps:
interface props {
  session: AbstractSessionModel
  model: WidgetModel // has model.type; feature widgets also have trackId/trackType
}
```

See also: `Core-extraFeaturePanel`. Unlike that point (which accumulates an
array of additive panels), `Core-replaceWidget` is singular (one widget
renders), so it stays a single-component fold: return your own component to
replace/wrap the default, or return the default unchanged to opt out.

Return value: The new React component you want to use

Note: Core-replaceWidget is called any time any widget opens, so if you are
trying to only customize e.g. the feature details widget, you can filter on
`model.trackId` because only feature detail widgets have a `trackId` field. You
can also filter on `model.type` (e.g. `'AlignmentsFeatureWidget'`), but the type
string varies depending on track type. To match a track id robustly (including
"user copies" of a track, which get a timestamp and `-sessionTrack` suffix
appended), use the `matchTrackId` helper with a `RegExp`:

```tsx
import { matchTrackId } from '@jbrowse/core/util'

pluginManager.addToExtensionPoint(
  'Core-replaceWidget',
  (DefaultWidget, { model }) =>
    matchTrackId(model.trackId, [/^volvox\.inv\.vcf/])
      ? MyWidget
      : DefaultWidget,
)
```

Example of Core-replaceWidget - add widget above the default widget

```tsx
pluginManager.addToExtensionPoint(
  'Core-replaceWidget',
  (DefaultWidget, { model }) => {
    // replace widget for this particular track ID
    return model.trackId !== 'volvox.inv.vcf'
      ? DefaultWidget
      : function NewWidget(props) {
          // this new widget adds a custom panel above the old DefaultWidget,
          // but you can replace it with any contents that you want
          return (
            <div>
              <div>Custom content here above the default details widget</div>
              <DefaultWidget {...props} />
            </div>
          )
        }
  },
)
```

**Why trackId, not config:** it is not always possible to retrieve the
configuration associated with a track that produced the feature details.
Therefore, we check `model.trackId` that produced the popup instead.

**Matching "user copy" tracks:** if you want e.g. a "User copy" of your track to
get the same treatment, match the trackId with a `RegExp` via `matchTrackId`
(shown above) rather than an exact compare. The copy of a track has a timestamp
and `-sessionTrack` appended to its id.

### Core-extraFeaturePanel

type: synchronous

Adds extra panels to the feature details widget. This point **accumulates an
array of React components**: each callback appends its own panel and returns the
array, so panels from multiple plugins compose instead of overwriting one
another. Each component renders its own card chrome (use `BaseCard` for a titled
section) and is rendered after the built-in Attributes/Sequence sections. The
default is an empty array.

- `args` - `React.ComponentType<FeaturePanelProps>[]` - the accumulated panels,
  empty by default. Append yours and return the array.
- `props` - the feature-detail props below, also passed to each component

```typescript
import type { FeaturePanelProps } from '@jbrowse/core/PluginManager'
// FeaturePanelProps:
interface props {
  model: FeatureWidgetModel // has model.trackId / model.trackType
  feature: SimpleFeatureSerialized // snapshot of the feature object
}
```

The `model` has `model.trackId`, `model.trackType`, and `model.track`, though
`model.track` may be undefined if the user closed the track (trackId/trackType
remain defined either way). Derive the session with `getSession(model)` if you
need it.

A panel decides for itself whether it applies by returning `null`. This is
idiomatic React and keeps the registration trivial:

```tsx
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'

pluginManager.addToExtensionPoint(
  'Core-extraFeaturePanel',
  (panels, { model }) => [
    ...panels,
    function ExtraFeaturePanel({ model, feature }) {
      return model.trackType === 'VariantTrack' ? (
        <BaseCard title="Extra info">{/* your content */}</BaseCard>
      ) : null
    },
  ],
)
```

Or scope at registration so you only append when the track matches. Use
`matchTrackId` (accepts a `RegExp`) so a "user copy" of the track, which gets a
timestamp and `-sessionTrack` suffix appended to its id, still matches:

```tsx
import { matchTrackId } from '@jbrowse/core/util'

pluginManager.addToExtensionPoint(
  'Core-extraFeaturePanel',
  (panels, { model }) =>
    matchTrackId(model.trackId, [/^volvox_filtered_vcf/])
      ? [...panels, MyVariantPanel]
      : panels,
)
```

:::note

This extension point previously folded to a **single** component. It now
accumulates an **array**. Append your component (`[...panels, MyPanel]`) and
return the array. A legacy callback that returns a bare component is still
tolerated (it's normalized into the array), but to compose with other plugins'
panels you must append rather than replace.

:::

### Core-preProcessTrackConfig

type: synchronous

- `args` - `SnapshotIn<AnyConfigurationModel>` - Copy of the current track
  config

Return value: A new track config

Example:

```typescript
pluginManager.addToExtensionPoint('Core-preProcessTrackConfig', snap => {
  return {
    ...snap,
    metadata: {
      ...snap.metadata,
      extraMetadata: 'extra metadata',
    },
  }
})
```

### TrackSelector-multiTrackMenuItems

type: synchronous

- `args` - `MenuItem[]` - an array of items that you can accumulate on
- `props` - an object of the form below

```typescript
interface props {
  session: AbstractSessionModel
}
```

Used to add new menu items to the "shopping cart" in the header of the
hierarchical track menu when tracks are added to the selection.

Example:
https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/CreateMultiWiggleExtension/index.ts#L10-L67

### TrackSelector-folderDialog

type: synchronous

Replaces the dialog that opens when a user clicks a folder category (supertrack)
in the hierarchical track selector. The default dialog shows a faceted track
selector scoped to the tracks in that category. Use this extension point to
provide a custom UI for a specific category.

- `args` - a React component (the default `DefaultFolderDialog`)
- `props` - an object of the type below

```typescript
interface props {
  categoryId: string // internal ID of the folder category, e.g. "Tracks-Wiggle,My Subcategory"
  model: HierarchicalTrackSelectorModel
  subtracks: TreeNode[] // flat list of all track nodes under this category (recursive)
}
```

Return value: A React component that will be rendered as the dialog. The
component receives the following props:

```typescript
interface DialogProps {
  model: HierarchicalTrackSelectorModel
  title: string // the display name of the category
  subtracks: TreeNode[] // same flat list of track nodes passed in props above
  handleClose: () => void
}
```

The `categoryId` format is `Tracks-{categoryPath}`, where `categoryPath` is the
comma-joined path of category names matching the track's `category` config
field. For example, a track with `"category": ["Wiggle", "My Subcategory"]`
produces `categoryId = "Tracks-Wiggle,My Subcategory"`.

Example: custom dialog for a specific folder category

```javascript
pluginManager.addToExtensionPoint(
  'TrackSelector-folderDialog',
  (DefaultComponent, { categoryId, model, subtracks }) => {
    if (categoryId !== 'Tracks-Wiggle,My Subcategory') {
      return DefaultComponent
    }

    const React = pluginManager.jbrequire('react')
    const { observer } = pluginManager.jbrequire('mobx-react')
    const { Dialog, DialogTitle, DialogContent, DialogActions, Button } =
      pluginManager.jbrequire('@mui/material')

    return observer(function MyFolderDialog({
      model,
      title,
      subtracks,
      handleClose,
    }) {
      const { shownTrackIds, view } = model
      const tracks = subtracks.filter(s => s.type === 'track')

      return React.createElement(
        Dialog,
        { open: true, onClose: handleClose, maxWidth: 'sm', fullWidth: true },
        React.createElement(DialogTitle, null, title),
        React.createElement(
          DialogContent,
          null,
          ...tracks.map(track =>
            React.createElement(
              'div',
              {
                key: track.trackId,
                onClick: () => view.toggleTrack(track.trackId),
                style: {
                  padding: 12,
                  marginBottom: 8,
                  border: shownTrackIds.has(track.trackId)
                    ? '2px solid #1976d2'
                    : '2px solid #ddd',
                  cursor: 'pointer',
                },
              },
              track.name,
            ),
          ),
        ),
        React.createElement(
          DialogActions,
          null,
          React.createElement(Button, { onClick: handleClose }, 'Close'),
        ),
      )
    })
  },
)
```

A more complete example using this extension point is in
[test_data/volvox/umd_plugin.js](https://github.com/GMOD/jbrowse-components/blob/main/test_data/volvox/umd_plugin.js)
(search for `TrackSelector-folderDialog`).

### LaunchView-LinearGenomeView

type: async

Launches a linear genome view. Rarely extended directly, but useful as a
reference for implementing a `LaunchView-*` point for your own view type. See
[Creating view types](/docs/developer_guides/creating_view).

- `args` - an object with the following format

```typescript
import type { LaunchLinearGenomeViewArgs } from '@jbrowse/plugin-linear-genome-view'
// LaunchLinearGenomeViewArgs:
interface args {
  session: AbstractSessionModel
  assembly?: string
  loc?: string
  tracks?: TrackInit[] // string trackId, or { trackId, displaySnapshot?, trackSnapshot? }
  tracklist?: boolean
  nav?: boolean
  highlight?: string[]
}
```

https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/index.ts#L131-L189

### LaunchView-CircularView

type: async

Launches a circular view.

- `args` - an object with the following format

```typescript
interface args {
  session: AbstractSessionModel // the session model
  assembly: string // assembly name
  tracks: string[] // array of track IDs
}
```

https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/index.ts#L30-L66

### LaunchView-SvInspectorView

type: async

Launches an SV inspector.

- `args` - an object with the following format

```typescript
interface args {
  session: AbstractSessionModel // the session model
  assembly: string // assembly name
  uri: string // uri for file to load into the SV inspector
  fileType?: string // type of file referred to by the uri ("VCF"|"CSV"|"BEDPE",etc) if uri extension does not properly hint at the file type
}
```

https://github.com/GMOD/jbrowse-components/blob/main/plugins/sv-inspector/src/index.ts#L21-L61

### LaunchView-SpreadsheetView

type: async

Launches a spreadsheet view.

- `args` - an object with the following format

```typescript
interface args {
  session: AbstractSessionModel // the session model
  assembly: string // assembly name
  uri: string // uri for file to load into the spreadsheet view
  fileType?: string // type of file referred to by the uri ("VCF"|"CSV"|"BEDPE",etc) if uri extension does not properly hint at the file type
}
```

https://github.com/GMOD/jbrowse-components/blob/main/plugins/spreadsheet-view/src/index.ts#L26-L59

### LaunchView-DotplotView

type: async

Launches a dotplot view.

```typescript
interface args {
  session: AbstractSessionModel // the session model
  views: {
    loc: string
    assembly: string
    tracks?: string[]
  }[] // array of length 2, for vert and horiz
  tracks: string[] // synteny track IDs to load on open
}
```

https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/LaunchDotplotView.ts#L7-L46

### LaunchView-LinearSyntenyView

type: async

Launches a linear synteny view.

```typescript
interface args {
  session: AbstractSessionModel // the session model
  views: {
    loc: string // locstring
    assembly: string // assembly name
    tracks?: string[] // trackIDs to open on top and bottom
  }[] // array of length 2, for top and bottom rows of synteny view
  tracks: string[] // synteny track IDs to load on open
}
```

https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LaunchLinearSyntenyView.ts#L9-L68

### LinearGenomeView-TracksContainerComponent

type: synchronous

- `args` - `ReactNode[]` - accumulator array of React nodes rendered inside the
  TracksContainer div
- `props` - an object of the type below

```typescript
interface props {
  model: LinearGenomeViewModel
}
```

Allows rendering a custom overlay component inside the LinearGenomeView
TracksContainer. Used e.g. to render highlights as a full-height div over the
tracks area. Append to the array and return it.

### LinearGenomeView-OverviewScalebarComponent

type: synchronous

- `args` - `ReactNode[]` - accumulator array of React nodes rendered inside the
  overview scalebar
- `props` - an object of the type below

```typescript
interface props {
  model: LinearGenomeViewModel
  overview: Base1DViewModel
}
```

Allows rendering custom overlay components inside the overview scalebar, e.g.
bookmark highlights. Append to the array and return it.

### LinearGenomeView-searchResultSelected

type: async

- `args` - `undefined` (notification point, no accumulator)
- `props` - an object of the type below

```typescript
interface props {
  session: AbstractSessionModel
  result: BaseResult // the search result that was selected
  model: LinearGenomeViewModel
  assemblyName: string
}
```

Called when a search result is selected in the LinearGenomeView search box.
Fires after navigation (if the result has a location). Useful for taking
additional action after a search, e.g. selecting a corresponding feature.

This is a notification-style extension point: the payload lives in `props`
(passed unchanged to every callback) rather than `args`, because callbacks
should not be able to alter what subsequent callbacks see.

Example:

```typescript
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

pluginManager.addToExtensionPoint(
  'LinearGenomeView-searchResultSelected',
  (_, props) => {
    const { result, model } = props as {
      result: BaseResult
      model: LinearGenomeViewModel
      assemblyName: string
    }
    const trackId = result.getTrackId()
    if (trackId === 'my_custom_track') {
      // perform custom action
    }
  },
)
```

### DotplotView-ImportFormSyntenyOptions

type: synchronous

- `args` - `DotplotImportFormSyntenyOption[]` - an array of custom radio options
  to add to the dotplot import form's synteny track selector
- `props` - an object of the type below

```typescript
interface props {
  model: DotplotViewModel // instance of the dotplot view model
  assembly1: string // name of the y-axis assembly
  assembly2: string // name of the x-axis assembly
}
```

Allows plugins to add custom radio options to the DotplotView import form. When
a user selects a custom radio option, the plugin's React component is rendered.

Each option in the array should have the following structure:

```typescript
interface DotplotImportFormSyntenyOption {
  value: string // unique identifier for the radio option
  label: string // display text for the radio option
  ReactComponent: React.FC<{
    model: DotplotViewModel
    assembly1: string
    assembly2: string
  }>
}
```

Example: adding a custom synteny option that fetches data from a server

```typescript
import type { DotplotImportFormSyntenyOption } from '@jbrowse/plugin-dotplot-view'

pluginManager.addToExtensionPoint(
  'DotplotView-ImportFormSyntenyOptions',
  (
    options: DotplotImportFormSyntenyOption[],
    { model, assembly1, assembly2 },
  ) => {
    return [
      ...options,
      {
        value: 'my-server-synteny',
        label: 'Load from my server',
        ReactComponent: MySyntenyServerComponent,
      },
    ]
  },
)
```

### DotplotView-SyntenyFileFormats

type: synchronous

- `args` - `SyntenyFileFormatOption[]` - array of file format options for the
  "New track" panel in the dotplot import form

Allows plugins to add support for new synteny file formats in the DotplotView
import form. The built-in formats (`.paf`, `.delta`, `.out`, `.chain`,
`.anchors`, `.anchors.simple`, `.pif.gz`) are the initial value; each callback
appends to or replaces entries.

Each option should have the following structure:

```typescript
interface SyntenyFileFormatOption {
  extension: string // label and radio button value, e.g. '.maf'
  Component: React.FC<{
    assembly1: string
    assembly2: string
    onAdapterChange: (r: { adapter: object; name: string } | undefined) => void
  }>
}
```

`onAdapterChange` should be called with the built adapter config whenever the
user's file selection is complete, or `undefined` when the selection is cleared.

Example: adding a custom `.maf` format

```typescript
pluginManager.addToExtensionPoint(
  'DotplotView-SyntenyFileFormats',
  (formats: SyntenyFileFormatOption[]) => [
    ...formats,
    {
      extension: '.maf',
      Component: ({ assembly1, assembly2, onAdapterChange }) => (
        <MafFileSelector
          assembly1={assembly1}
          assembly2={assembly2}
          onAdapterChange={onAdapterChange}
        />
      ),
    },
  ],
)
```

### LinearSyntenyView-SyntenyFileFormats

type: synchronous

Same as `DotplotView-SyntenyFileFormats` but for the LinearSyntenyView import
form. Includes `selectedRow` context in props but the `Component` interface is
identical. The parent handles `selectedRow` internally.

### LinearSyntenyView-ImportFormSyntenyOptions

type: synchronous

- `args` - `LinearSyntenyImportFormSyntenyOption[]` - an array of custom radio
  options to add to the linear synteny view import form's synteny track selector
- `props` - an object of the type below

```typescript
interface props {
  model: LinearSyntenyViewModel
  assembly1: string // name of the top assembly
  assembly2: string // name of the bottom assembly
}
```

Allows plugins to add custom radio options to the LinearSyntenyView import form.
Same pattern as `DotplotView-ImportFormSyntenyOptions`.

Each option should have the following structure:

```typescript
import type { LinearSyntenyImportFormSyntenyOption } from '@jbrowse/plugin-linear-comparative-view'
// LinearSyntenyImportFormSyntenyOption:
interface option {
  value: string
  label: string
  ReactComponent: React.FC<{
    model: LinearSyntenyViewModel
    assembly1: string
    assembly2: string
  }>
}
```

Example:

```typescript
import type { LinearSyntenyImportFormSyntenyOption } from '@jbrowse/plugin-linear-comparative-view'

pluginManager.addToExtensionPoint(
  'LinearSyntenyView-ImportFormSyntenyOptions',
  (options: LinearSyntenyImportFormSyntenyOption[]) => {
    return [
      ...options,
      {
        value: 'my-server-synteny',
        label: 'Load from my server',
        ReactComponent: MySyntenyServerComponent,
      },
    ]
  },
)
```

### Extension point footnote

Users that want to add further extension points can do so, by simply calling

```typescript
const returnVal = pluginManager.evaluateExtensionPoint(
  'YourCustomNameHere',
  processThisValue,
  extraContext,
)
```

Then, any code that had used:

```typescript
pluginManager.addToExtensionPoint(
  'YourCustomNameHere',
  (processThisValue, extraContext) => {
    /* the first arg is the "processThisValue" from the extension point, it may
    get mutated if multiple extension points are chained together

    the second argument to the extension point is the extra context from
    evaluating the extension point. it does not get mutated even if there is a
    chain of values, it is passed as is to each one*/
    return processThisValue
  },
)
```

The naming system, "Core-" just refers to the fact that these extension points
are from our core codebase. Plugin developers may choose their own prefix to
avoid collisions.

## See also

- [Pluggable elements](/docs/developer_guides/pluggable_elements)
- [Custom view types](/docs/developer_guides/creating_view)
- [Top-level menu items](/docs/developer_guides/menus)
- [Add-track workflows](/docs/developer_guides/creating_addtrack_workflow)
