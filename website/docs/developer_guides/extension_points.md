---
id: extension_points
title: Extension points
toplevel: true
---

The basic API is that producers can say:

```js
const ret = pluginManager.evaluateExtensionPoint('ExtensionPointName', {
  value: 1,
})
```

And consumers can say:

```js
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

```js
// extra props are optional, can pass an extra context object your extension point receives
pluginManager.evaluateExtensionPoint(extensionPointName, args, props)
```

There is also an async method:

```js
// extra props are optional, can pass an extra context object your extension point receives
pluginManager.evaluateAsyncExtensionPoint(extensionPointName, args, props)
```

Users can additionally add to extension points, so that when they are evaluated,
it runs a chain of callbacks that are registered to that extension point:

```js
pluginManager.addToExtensionPoint(extensionPointName, callback => newArgs)
```

The newArgs returned by your callback are passed on as the args to the next in
the chain.

Here are the extension points in the core codebase:

### Core-extendPluggableElement

`args`:

- `pluggableElement:PluggableElement` - this

type: synchronous

used to add extra functionality to e.g state tree models, for example, extra
right-click context menus. your callback will receive every pluggable element
registered to the system

https://github.com/GMOD/jbrowse-components/blob/6ceeac51f8bcecfc3b0a99e23f2277a6e5a7662e/plugins/dotplot-view/src/extensionPoints.ts#L9-L43

### Core-guessAdapterForLocation

type: synchronous

used to infer an adapter type given a location type from the "Add track"
workflow. you will receive a callback asking if you can provide an adapter
config given a location object

https://github.com/GMOD/jbrowse-components/blob/6ceeac51f8bcecfc3b0a99e23f2277a6e5a7662e/plugins/gff3/src/index.ts#L27-L53

### Core-guessTrackTypeForLocation

type: synchronous

used to infer a track type given a location type from the "Add track workflow"

example
https://github.com/GMOD/jbrowse-components/blob/6ceeac51f8bcecfc3b0a99e23f2277a6e5a7662e/plugins/alignments/src/index.ts#L108-L118

### Core-extendSession

type: synchronous

used to extend the session model itself with new features

- `session: AbstractSessionModel` - instance of the session model to customize
  the about dialog

### Core-customizeAbout

type: synchronous

- `config: Record<string,unknown>` - a snapshot of a configuration object that
  is displayed in the about dialog

### TrackSelector-multiTrackMenuItems

type: synchronous

used to add new menu items to the "shopping cart" in the header of the
hierarchical track menu when tracks are added to the selection

example
https://github.com/GMOD/jbrowse-components/blob/6ceeac51f8bcecfc3b0a99e23f2277a6e5a7662e/plugins/wiggle/src/CreateMultiWiggleExtension/index.ts#L10-L67

### LaunchView-LinearGenomeView

type: async

launches a linear genome view given parameters. it is not common to extend this
extension point, but you can use it as an example to create a LaunchView type
for your own view

- `session: AbstractSessionModel` - instance of the session which you can call
  actions on
- `assembly: string` - assembly name
- `loc: string` - a locstring
- `tracks: string[]` - array of trackIds

https://github.com/GMOD/jbrowse-components/blob/6ceeac51f8bcecfc3b0a99e23f2277a6e5a7662e/plugins/linear-genome-view/src/index.ts#L131-L189

### LaunchView-CircularView

type: async

similar to LaunchView-LinearGenomeView, this is not common to extend, but you
can use it as an example to create a LaunchView type for your own view

- `session: AbstractSessionModel` - instance of the session which you can call
  actions on
- `assembly: string` - assembly name
- `tracks: string[]` - array of trackIds

https://github.com/GMOD/jbrowse-components/blob/6ceeac51f8bcecfc3b0a99e23f2277a6e5a7662e/plugins/circular-view/src/index.ts#L30-L66

### LaunchView-SvInspectorView

type: async

launches a sv inspector with given parameters. it is not common to extend this
extension point, but you can use it as an example to create a LaunchView type
for your own view

- `session: AbstractSessionModel` - instance of the session which you can call
  actions on
- `assembly: string` - assembly name
- `uri: string` - a url to load
- `fileType?: string` - type of file referred to by locstring (VCF|CSV|BEDPE,
  etc)

https://github.com/GMOD/jbrowse-components/blob/6ceeac51f8bcecfc3b0a99e23f2277a6e5a7662e/plugins/sv-inspector/src/index.ts#L21-L61

### LaunchView-SpreadsheetView

type: async

launches a sv inspector with given parameters. it is not common to extend this
extension point, but you can use it as an example to create a LaunchView type
for your own view

- `session: AbstractSessionModel` - instance of the session which you can call
  actions on
- `assembly: string` - assembly name
- `uri: string` - a url to load
- `fileType?: string` - type of file referred to by locstring (VCF|CSV|BEDPE,
  etc)

https://github.com/GMOD/jbrowse-components/blob/6ceeac51f8bcecfc3b0a99e23f2277a6e5a7662e/plugins/spreadsheet-view/src/index.ts#L26-L59

### LaunchView-DotplotView

type: async

launches a dotplot with given parameters. it is not common to extend this
extension point, but you can use it as an example to create a LaunchView type
for your own view

- `session: AbstractSessionModel` - instance of the session which you can call
  actions on
- `views: { loc: string; assembly: string; tracks?: string[] }[]` - view params
  for vertical and horizontal
- `tracks: string[]` - trackIds to turn on

https://github.com/GMOD/jbrowse-components/blob/6ceeac51f8bcecfc3b0a99e23f2277a6e5a7662e/plugins/dotplot-view/src/LaunchDotplotView.ts#L7-L46

### LaunchView-DotplotView

type: async

launches a linear synteny view with given parameters. it is not common to extend
this extension point, but you can use it as an example to create a LaunchView
type for your own view

- `session: AbstractSessionModel` - instance of the session which you can call
  actions on
- `views: { loc: string; assembly: string; tracks?: string[] }[]` - view params
  for vertical and horizontal
- `tracks: string[]` - trackIds to turn on

https://github.com/GMOD/jbrowse-components/blob/6ceeac51f8bcecfc3b0a99e23f2277a6e5a7662e/plugins/linear-comparative-view/src/LaunchLinearSyntenyView.ts#L9-L68

### Core-replaceAbout

type: synchronous

adds option to provide a different component for the "About this track" dialog

- `session: AbstractSessionModel` - instance of the session which you can call
- `config: AnyConfigurationModel` - a configuration object for the track

Return value: The new React component you want to use

example: replaces about dialog for a particular track ID

```js
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

- `session: AbstractSessionModel` - instance of the session which you can call
- `config: AnyConfigurationModel` - a configuration object for the track

Return value: An object with the name of the panel and the React component to
use for the panel

example: adds an extra about dialog panel for a particular track ID

```js
pluginManager.addToExtensionPoint(
  'Core-extraAboutPanel',
  (DefaultAboutExtra, { /*session,*/ config }) => {
    return config.trackId === 'volvox_sv_test'
      ? { name: 'More info', Component: ExtraAboutPanel }
      : DefaultAboutExtra
  },
)
```

### Core-customizeAbout

type: synchronous

- `config: Record<string, unknown>` a snapshot of a configuration object for the
  track, with `formatAbout` already applied to it

Return value: New config snapshot object

### Core-replaceWidget

type: synchronous

adds option to provide a different component for the "About this track" dialog

- `session: AbstractSessionModel` - instance of the session which you can call
- `model: WidgetModel` - a widget model. this is called for every widget type,
  including configuration, feature details, about panel, and more. The feature
  details may be a common one. See `Core-extraFeaturePanel` also, matches the
  model attribute from there

Return value: The new React component you want to use

example: replaces about feature details widget for a particular track ID

```js
pluginManager.addToExtensionPoint(
  'Core-replaceAbout',
  (DefaultAboutComponent, { model }) => {
    return model.trackId === 'volvox.inv.vcf'
      ? NewAboutComponent
      : DefaultAboutComponent
  },
)
```

Note: it is not always possible to retrieve the configuration associated with a
track that produced the feature details. Therefore, we check model.trackId that
produced the popup instead. note that if you want copies of your track to get
same treatment, might use a regex to loose match the trackId (the copy of a
track will have a timestamp and -sessionTrack added to it).

### Core-extraFeaturePanel

type: synchronous

- `model: BaseFeatureWidget` - the BaseFeatureWidget model. This has properties
  `model.trackId`, `model.trackType`, and `model.track`, though track may be
  undefined if the user closed the track, while trackId and trackType will be
  defined even if user closed the track
- `feature: Record<string, unknown>` a snapshot of a feature object
- `session: AbstractSessionModel` - instance of the session which you can call

Return value: An object with the name of the panel and the React component to
use for the panel

example

```js
pluginManager.addToExtensionPoint(
  'Core-extraFeaturePanel',
  (DefaultFeatureExtra, { model }) => {
    return model.trackId === 'volvox_filtered_vcf'
      ? { name: 'Extra info', Component: ExtraFeaturePanel }
      : DefaultFeatureExtra
  },
)
```

### Extension point footnote

Users that want to add further extension points can do so, by simply calling

```js
const returnVal = pluginManager.evaluateExtensionPoint(
  'YourCustomNameHere',
  processThisValue,
  extraContext,
)
```

Then, any code that had used:

```js
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
