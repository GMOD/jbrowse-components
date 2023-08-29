---
id: extension_points
title: Extension points
---

The basic API is that producers can say:

```typescript
const ret = pluginManager.evaluateExtensionPoint('ExtensionPointName', {
  value: 1,
})
```

And consumers can say:

```typescript
pluginManager.addToExtensionPoint('ExtensionPointName', arg => {
  return arg.value + 1
})

pluginManager.addToExtensionPoint('ExtensionPointName', arg => {
  return arg.value + 1
})
```

In this case, `arg` that is passed in evaluateExtensionPoint calls all the
callbacks that have been registered by `addToExtensionPoint`. If multiple
extension points are registered, the return value of the first extension point
is passed as the new argument to the second, and so on (they are chained
together).

So in the example above, ret would be `{value:3}` after evaluating the extension
point.

In the core codebase, we have the concept of extension points that users can
call or add to.

The API is

```typescript
// extra props are optional, can pass an extra context object your extension
// point receives
pluginManager.evaluateExtensionPoint(extensionPointName, args, props)
```

Args are 'accumulated' (e.g. the return value of your extension point is passed
along to the args argument of the next one), and props are just passed along

There is also an async method:

```typescript
// extra props are optional, can pass an extra context object your extension
// point receives
pluginManager.evaluateAsyncExtensionPoint(extensionPointName, args, props)
```

Users can additionally add to extension points, so that when they are evaluated,
it runs a chain of callbacks that are registered to that extension point:

```typescript
pluginManager.addToExtensionPoint(extensionPointName, callback => newArgs)
```

The newArgs returned by your callback are passed on as the args to the next in
the chain.

Here are the extension points in the core codebase:

### Core-extendPluggableElement

- `args` - `pluggableElement:PluggableElement` - this
- `props` - none

type: synchronous

used to add extra functionality to e.g state tree models, for example, extra
right-click context menus. your callback will receive every pluggable element
registered to the system

https://github.com/GMOD/jbrowse-components/blob/6ceeac51f8bcecfc3b0a99e23f2277a6e5a7662e/plugins/dotplot-view/src/extensionPoints.ts#L9-L43

### Core-guessAdapterForLocation

type: synchronous

- `args` - adapter config

used to infer an adapter type given a location type from the "Add track"
workflow. you will receive a callback asking if you can provide an adapter
config given a location object

https://github.com/GMOD/jbrowse-components/blob/6ceeac51f8bcecfc3b0a99e23f2277a6e5a7662e/plugins/gff3/src/index.ts#L27-L53

### Core-guessTrackTypeForLocation

type: synchronous

- `args` - `FileLocation` object

used to infer a track type given a location type from the "Add track workflow"

example
https://github.com/GMOD/jbrowse-components/blob/6ceeac51f8bcecfc3b0a99e23f2277a6e5a7662e/plugins/alignments/src/index.ts#L108-L118

### Core-extendSession

type: synchronous

used to extend the session model itself with new features

- `args` - `AbstractSessionModel` - instance of the session model to customize
  the about dialog

### Core-replaceAbout

type: synchronous

adds option to provide a different component for the "About this track" dialog

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

adds option to provide a different component for the "About this track" dialog

```typescript
interface props {
  session: AbstractSessionModel
  config: AnyConfigurationModel
}
```

Return value: An object with the name of the panel and the React component to
use for the panel

Example: adds an extra about dialog panel for a particular track ID

```typescript
pluginManager.addToExtensionPoint(
  'Core-extraAboutPanel',
  (DefaultAboutExtra, { session, config }) => {
    return config.trackId === 'volvox_sv_test'
      ? { name: 'More info', Component: ExtraAboutPanel }
      : DefaultAboutExtra
  },
)
```

### Core-customizeAbout

type: synchronous

- `args` - a config snapshot `Record<string, unknown>` for the track, with
  `formatAbout` already applied to it

Return value: New config snapshot object

### Core-replaceWidget

type: synchronous

adds option to provide a different component for a given widget, drawer or modal

- `args` - a `ReactComponent`
- `props` - an object of the type below

```typescript
interface props {
  session: AbstractSessionModel
  model: WidgetModel
}
```

See also: `Core-extraFeaturePanel`

Return value: The new React component you want to use

Note: Core-replaceWidget is called any time any widget opens, so if you are
trying to only customize e.g. the feature details widget, you can filter on
widget.trackId because only feature detail widgets has a 'trackId' field. You
can filter on widget.type also but this is stringly typed, and may vary
depending on track type.

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

Note 1: it is not always possible to retrieve the configuration associated with
a track that produced the feature details. Therefore, we check model.trackId
that produced the popup instead.

Note 2: If you want e.g. a "User copy" of your track to get same treatment,
might use a regex to loose match the trackId (the copy of a track will have a
timestamp and -sessionTrack added to it).

### Core-extraFeaturePanel

type: synchronous

- `args` - a `ReactComponent`, the default AboutTrack dialog
- `props` - an object of the type below

```typescript
interface props {
  model: BaseFeatureWidget // a widget model, has model.trackId defined if you want to check track
  feature: Record<string, unknown> // snapshot of feature object
  session: AbstractSessionModel
}
```

Note: the model has properties `model.trackId`, `model.trackType`, and
`model.track`, though `model.track` may be undefined if the user closed the
track, while trackId and trackType will be defined even if user closed the track

Return value: An object with the name of the panel and the React component to
use for the panel

Example:

```typescript
pluginManager.addToExtensionPoint(
  'Core-extraFeaturePanel',
  (DefaultFeatureExtra, { model }) => {
    return model.trackId === 'volvox_filtered_vcf'
      ? { name: 'Extra info', Component: ExtraFeaturePanel }
      : DefaultFeatureExtra
  },
)
```

### Core-preProcessTrackConfig

type: synchronous

- `args` - `SnapshotIn<AnyConfigurationModel>` - Copy of the current track
  config

Return value: A new track config

Example:

```typescript
pluginManager.addToExtensionPoint('Core-preProcessTrackConfig', snap => {
  return {
    ...snap.metadata,
    extraMetadata: 'extra metadata',
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

used to add new menu items to the "shopping cart" in the header of the
hierarchical track menu when tracks are added to the selection

example
https://github.com/GMOD/jbrowse-components/blob/6ceeac51f8bcecfc3b0a99e23f2277a6e5a7662e/plugins/wiggle/src/CreateMultiWiggleExtension/index.ts#L10-L67

### LaunchView-LinearGenomeView

type: async

launches a linear genome view given parameters. it is not common to extend this
extension point, but you can use it as an example to create a LaunchView type
for your own view

- `args` - an object with the following format

```typescript
interface args {
  session: AbstractSessionModel // the session model
  assembly: string // assembly name
  loc: string // locstring
  tracks: string[] // array of track IDs
}
```

https://github.com/GMOD/jbrowse-components/blob/6ceeac51f8bcecfc3b0a99e23f2277a6e5a7662e/plugins/linear-genome-view/src/index.ts#L131-L189

### LaunchView-CircularView

type: async

similar to LaunchView-LinearGenomeView, this is not common to extend, but you
can use it as an example to create a LaunchView type for your own view

- `args` - an object with the following format

```typescript
interface args {
  session: AbstractSessionModel // the session model
  assembly: string // assembly name
  tracks: string[] // array of track IDs
}
```

https://github.com/GMOD/jbrowse-components/blob/6ceeac51f8bcecfc3b0a99e23f2277a6e5a7662e/plugins/circular-view/src/index.ts#L30-L66

### LaunchView-SvInspectorView

type: async

launches a sv inspector with given parameters. it is not common to extend this
extension point, but you can use it as an example to create a LaunchView type
for your own view

- `args` - an object with the following format

```typescript
interface args {
  session: AbstractSessionModel // the session model
  assembly: string // assembly name
  uri: string // uri for file to load into the SV inspector
  fileType?: string // type of file referred to by the uri ("VCF"|"CSV"|"BEDPE",etc) if uri extension does not properly hint at the file type
}
```

https://github.com/GMOD/jbrowse-components/blob/6ceeac51f8bcecfc3b0a99e23f2277a6e5a7662e/plugins/sv-inspector/src/index.ts#L21-L61

### LaunchView-SpreadsheetView

type: async

launches a sv inspector with given parameters. it is not common to extend this
extension point, but you can use it as an example to create a LaunchView type
for your own view

- `args` - an object with the following format

```typescript
interface args {
  session: AbstractSessionModel // the session model
  assembly: string // assembly name
  uri: string // uri for file to load into the SV inspector
  fileType?: string // type of file referred to by the uri ("VCF"|"CSV"|"BEDPE",etc) if uri extension does not properly hint at the file type
}
```

https://github.com/GMOD/jbrowse-components/blob/6ceeac51f8bcecfc3b0a99e23f2277a6e5a7662e/plugins/spreadsheet-view/src/index.ts#L26-L59

### LaunchView-DotplotView

type: async

launches a dotplot with given parameters. it is not common to extend this
extension point, but you can use it as an example to create a LaunchView type
for your own view

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

https://github.com/GMOD/jbrowse-components/blob/6ceeac51f8bcecfc3b0a99e23f2277a6e5a7662e/plugins/dotplot-view/src/LaunchDotplotView.ts#L7-L46

### LaunchView-LinearSyntenyView

type: async

launches a linear synteny view with given parameters. it is not common to extend
this extension point, but you can use it as an example to create a LaunchView
type for your own view

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

https://github.com/GMOD/jbrowse-components/blob/6ceeac51f8bcecfc3b0a99e23f2277a6e5a7662e/plugins/linear-comparative-view/src/LaunchLinearSyntenyView.ts#L9-L68

### LinearGenomeView-TracksContainer

type: synchronous

- `args` - `React.ReactNode[]` - an array of rendered react components
  (ReactNode) which you can append to
- `props` - an object of the type below

```typescript
interface props {
  model: LinearGenomeViewModel // instance of the linear genome view model
}
```

Allows rendering a custom component as a child of the LinearGenomeView's
"TracksContainer". Used to render highlights for example with a div of height
100% over the TracksContainer

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
