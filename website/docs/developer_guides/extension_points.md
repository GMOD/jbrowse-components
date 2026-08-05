---
title: Extension points
description: Callbacks registered by producers and consumed across the app
guide_category: Core concepts
---

**TL;DR:** Extension points are named callback chains. A producer fires one with
`evaluateExtensionPoint`; plugins register callbacks with `addToExtensionPoint`,
each receiving the previous callback's return value.

## Using extension points

A producer fires a point:

```typescript
const ret = pluginManager.evaluateExtensionPoint('ExtensionPointName', {
  value: 1,
})
```

Consumers register callbacks against the same point (multiple plugins can each
register one):

```typescript
pluginManager.addToExtensionPoint(
  'ExtensionPointName',
  (arg: { value: number }) => {
    return { value: arg.value + 1 }
  },
)
```

Callbacks are chained: each receives the previous one's return value. If the
producer passes `{value:1}` and two such callbacks are registered, `ret` is
`{value:3}`.

## TypeScript types for extension points

Built-in points are registered in the `ExtensionPointRegistry` interface in
`@jbrowse/core/PluginManager`. `addToExtensionPoint` / `evaluateExtensionPoint`
/ `evaluateAsyncExtensionPoint` narrow to the registered types when you pass a
known name, so callbacks get typed `args` and evaluate calls return the correct
type without a cast.

Register your own point the same way:

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
compilation.

## API

```typescript
// props is an extra context object your callbacks receive, required for the
// points that declare one and omitted for the points that don't
pluginManager.evaluateExtensionPoint(extensionPointName, args, props)
pluginManager.evaluateAsyncExtensionPoint(extensionPointName, args, props)

pluginManager.addToExtensionPoint(extensionPointName, args => {
  return newArgs // passed as args to the next callback in the chain
})
```

`args` are accumulated (each callback's return value becomes the next callback's
`args`); `props` is passed through unchanged. `addToExtensionPoint` creates the
point if it doesn't exist yet.

## Extension point listing

Generated from the `#extensionPoint` tags at each point's fire/registration
site. The detailed sections that follow are hand-written.

**Shape** says what happens when a second plugin registers on the same point,
and is derived from whether the point's `args` are an array. A `list` point
accumulates, so every plugin's contribution survives. A `single` point threads
one value along, so each callback overwrites what the one before it returned and
only the last plugin to register is visible. The names don't carry this:
`DotplotView-OverlaySVGComponent` accumulates and
`DotplotView-OverlayHTMLComponent` does not. A blank shape means the point isn't
in `ExtensionPointRegistry` yet.

For `list` points that accumulate rendered elements, register with
`addExtensionElement` rather than by hand, so the array spread and the React
`key` aren't yours to get right:

<!-- include: plugins/linear-genome-view/src/LinearGenomeView/components/SequenceFeatureHoverHighlightExtension.tsx -->

```typescript
import { addExtensionElement } from '@jbrowse/core/ui'

import SequenceFeatureHoverHighlight from './SequenceFeatureHoverHighlight.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function SequenceFeatureHoverHighlightExtensionF(
  pluginManager: PluginManager,
) {
  addExtensionElement(
    pluginManager,
    'LinearGenomeView-TracksContainerComponent',
    SequenceFeatureHoverHighlight,
  )
}
```

<!-- EXTENSION_POINTS_INDEX START -->

<!-- prettier-ignore -->
| Extension point | Type | Shape | Description |
| --- | --- | --- | --- |
| `Core-addTrackComponent` | sync | single | Inject a custom React component into the add-track widget |
| `Core-customizeAbout` | sync | single | Transform the config shown in a track's About dialog |
| `Core-extendPluggableElement` | sync | single | Mutate any pluggable element after it is created |
| `Core-extendSession` | sync |  | Extend the session model with extra state or actions |
| `Core-extendWorker` | sync | single | Register extra RPC methods on the web worker |
| `Core-extraAboutPanel` | sync | list | Add extra panels to a track's About dialog |
| `Core-extraFeaturePanel` | sync | list | Add extra panels to the feature details widget |
| `Core-extraTrackMenuItems` | sync | list | Add items to a single track's menu |
| `Core-guessAdapterForLocation` | sync | single | Guess an adapter config from a file location |
| `Core-guessTrackTypeForLocation` | sync | single | Guess a track type from a file location |
| `Core-handleUnrecognizedAssembly` | sync |  | Supply an assembly config when a referenced assembly is unknown. May return a promise settling when the handler has finished trying, which is what lets waitForAssembly stop waiting without a timeout |
| `Core-preferencesDialogPanels` | sync | list | Add panels to the preferences dialog |
| `Core-preProcessTrackConfig` | sync | single | Rewrite a track config snapshot before it is instantiated |
| `Core-replaceAbout` | sync | single | Replace or wrap a track's About dialog body |
| `Core-replaceWidget` | sync | single | Replace or wrap the component that renders a widget |
| `Desktop-StartScreenLaunchPanel` | sync | single | Replace or wrap the "Launch new session" panel |
| `Desktop-StartScreenMenuItems` | sync | list | Add items to the start screen menu |
| `Desktop-StartScreenRecentSessionsPanel` | sync | single | Replace or wrap the recent sessions panel |
| `DotplotView-ImportFormSyntenyOptions` | sync | list | Add options to the dotplot view import form |
| `DotplotView-OverlayHTMLComponent` | sync | single | Add an HTML overlay component to the dotplot view |
| `DotplotView-OverlaySVGComponent` | sync | list | Add an SVG overlay component to the dotplot view |
| `DotplotView-SyntenyFileFormats` | sync | list | Add synteny file formats to the dotplot import form |
| `LaunchView-BreakpointSplitView` | async | single | Programmatically launch a breakpoint split view |
| `LaunchView-CircularView` | async | single | Programmatically launch a circular view |
| `LaunchView-DotplotView` | async | single | Programmatically launch a dotplot view |
| `LaunchView-LinearGenomeView` | async | single | Programmatically launch a linear genome view |
| `LaunchView-LinearSyntenyView` | async | single | Programmatically launch a linear synteny view |
| `LaunchView-SpreadsheetView` | async | single | Programmatically launch a spreadsheet view |
| `LaunchView-SvInspectorView` | async | single | Programmatically launch the SV inspector view |
| `LinearGenomeView-HighlightSVGComponent` | sync | list | Add an SVG highlight overlay in the LGV SVG export |
| `LinearGenomeView-OverviewScalebarComponent` | sync | list | Add a component to the overview scalebar |
| `LinearGenomeView-ScalebarHighlightComponent` | sync | list | Add a highlight component to the scalebar |
| `LinearGenomeView-searchResultSelected` | async | single | Invoked when a search result is selected |
| `LinearGenomeView-TracksContainerComponent` | sync | list | Add a component into the LGV tracks container |
| `LinearSyntenyView-ImportFormSyntenyOptions` | sync | list | Add options to the linear synteny view import form |
| `LinearSyntenyView-SyntenyFileFormats` | sync | list | Add synteny file formats to the linear synteny import form |
| `TrackSelector-folderDialog` | sync | single | Replace the dialog shown when a folder category is clicked |
| `TrackSelector-multiTrackMenuItems` | sync | list | Add items to the multi-track (shopping cart) menu |

<!-- EXTENSION_POINTS_INDEX END -->

### Core-extendPluggableElement

type: synchronous

- `args` - `PluggableElementType` - the pluggable element being installed
- `props` - none

Add functionality to pluggable elements, e.g. extra right-click context menus.
Your callback receives every pluggable element registered to the system. See
[](/docs/developer_guides/menus) for a worked example adding track context-menu
items.

Reference:
[`DotplotReadVsRef`](https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/DotplotReadVsRef/index.ts),
which adds a read-vs-reference item to the alignments context menu.

### Core-guessAdapterForLocation

type: synchronous

- `args` - `AdapterGuesser` - the guesser accumulated so far

Infer an adapter type from a location in the "Add track" workflow. See the
[add track workflow guide](/docs/developer_guides/creating_addtrack_workflow).

Use `addAdapterGuesser` rather than calling `addToExtensionPoint` directly:
these two points are chains of responsibility, where each callback wraps the
previously registered guesser and delegates to it when it has no match. The
helper does that wiring, so your callback just returns a config when it
recognizes the file and `undefined` when it doesn't. Delegating by hand is easy
to get subtly wrong: dropping the optional `file` argument on the way through
hides it from every guesser registered before yours.

The chain is first-match-wins, so it returns exactly one adapter and cannot
express "or this other one". Where two adapters genuinely read the same
extension, the one the chain does not pick declares that on its own registration
instead, and the "Add track" form offers it alongside the guess:

<!-- include: plugins/comparative-adapters/src/AllVsAllPAFAdapter/index.ts#alsoReads -->

```typescript
export default function AllVsAllPAFAdapterF(pluginManager: PluginManager) {
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'AllVsAllPAFAdapter',
        displayName: 'All-vs-all PAF adapter',
        configSchema,
        adapterMetadata: {
          category: 'Synteny adapters',
          // a .paf is claimed by PAFAdapter, and an all-vs-all one is
          // indistinguishable by name; read as pairwise it attributes one
          // genome's contigs to another rather than merely dropping them
          alsoReads: /\.paf(\.gz)?$/i,
        },
        getAdapterClass: () =>
          import('./AllVsAllPAFAdapter.ts').then(r => r.default),
      }),
  )
}
```

`alsoReads` is a form hint only. It does not enter this extension point, so a
file still resolves to one adapter headlessly, from the CLI, and in every
existing guesser. It also covers an extension no guesser claims at all, where
the file resolves to `UNKNOWN` and the adapter would otherwise have to be found
by name.

### Core-guessTrackTypeForLocation

type: synchronous

- `args` - `TrackTypeGuesser` - the guesser accumulated so far

Infer a track type from an adapter name (and, optionally, the file) in the "Add
track" workflow. Register it with `addTrackTypeGuesser`, the companion to
`addAdapterGuesser` above.

A format plugin normally registers both together:

<!-- include: plugins/hic/src/GuessAdapter/index.ts#guessers -->

```typescript
export default function GuessAdapterF(pluginManager: PluginManager) {
  addAdapterGuesser(pluginManager, (file, _index, adapterHint) => {
    const fileName = getFileName(file)
    return (/\.hic$/i.test(fileName) && !adapterHint) ||
      adapterHint === 'HicAdapter'
      ? {
          type: 'HicAdapter',
          hicLocation: file,
        }
      : undefined
  })
  addTrackTypeGuesser(pluginManager, adapterName =>
    adapterName === 'HicAdapter' ? 'HicTrack' : undefined,
  )
}
```

### Core-extendSession

type: synchronous

Extend the session model itself with new features.

- `args` - `AbstractSessionModel` - instance of the session model

### Core-replaceAbout

type: synchronous

Provide a different component for the "About this track" dialog.

- `args` - a `ReactComponent`, by default the AboutTrack dialog
- `props` - an object of the format below

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

Adds an extra panel to the "About this track" dialog, rendered below the
built-in Configuration/Metadata cards. Return a React component that renders its
own card chrome (use `BaseCard` for a titled section).

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

### Core-customizeAbout

type: synchronous

Transform the config snapshot shown in the "About this track" dialog, after any
`formatAbout` config has been applied.

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

Provide a different component for a given widget, drawer, or modal. This is a
`single` point, since one widget renders: a callback returns its own component
to take the slot, or the accumulated one to opt out. Contrast
[`Core-extraFeaturePanel`](#core-extrafeaturepanel), which accumulates additive
panels and is the right point when you want to _add_ to a feature details widget
rather than take it over.

- `args` - a `ReactComponent`
- `props` - an object of the type below

Import the props type from `@jbrowse/core/PluginManager`:

<!-- include: packages/core/src/PluginManager.ts#replaceWidgetProps -->

```typescript
export interface ReplaceWidgetProps {
  session: AbstractSessionModel
  /** has `type`; feature detail widgets also have `trackId` and `trackType` */
  model: WidgetModel
  toolbarHeight?: number
}
```

Return value: the new React component.

This point fires whenever **any** widget opens, so a callback that does not
scope itself takes over the drawer, the modal, and every feature details panel.
Rather than write that scoping by hand, use the two helpers below. They are the
supported way to use this point; reach for `addToExtensionPoint` directly only
for something neither one expresses.

#### addReplaceWidget: render something else entirely

```tsx
import { addReplaceWidget } from '@jbrowse/core/ui'

addReplaceWidget(pluginManager, {
  select: { trackId: 'volvox.inv.vcf' },
  component: MyWidget,
})
```

`select` accepts any combination of the fields below, and all of the ones you
give must match. Omitting `select` entirely matches every widget.

Two fields are shared with `addFeaturePanel`:

<!-- include: packages/core/src/ui/extensionSelectors.ts#fields -->

```typescript
export interface TrackSelectorFields {
  /** track type, e.g. `'VariantTrack'`, usually what "for my tracks" means */
  trackType?: string | string[]
  /** track id; a plain string also matches the user's copies of that track */
  trackId?: string | RegExp | (string | RegExp)[]
}
```

and a widget selector adds two more:

<!-- include: packages/core/src/ui/addReplaceWidget.tsx#selector -->

```typescript
export interface WidgetSelector extends TrackSelectorFields {
  /** widget model type, e.g. `'AlignmentsFeatureWidget'` */
  widgetType?: string | string[]
  /** escape hatch for anything the fields above cannot express */
  where?: (props: ReplaceWidgetProps) => boolean
}
```

Prefer `trackType` when what you mean is "my kind of track". A plain-string
`trackId` also matches the user's copies of that track (the "Copy track" menu
item appends a timestamp to the id), so scoping by id does not silently stop
applying the first time someone copies the track. Pass a `RegExp` if you want to
control the matching yourself.

We match on the model rather than on the config because the config that produced
a feature details widget isn't always retrievable.

#### addWidgetWrapper: add to the default widget

Most "replacements" really want to keep the default widget and put something
around it. That is a different helper, because the wrapper has to receive the
default rather than close over it:

```tsx
import { addWidgetWrapper } from '@jbrowse/core/ui'

addWidgetWrapper(pluginManager, {
  select: { trackType: 'VariantTrack' },
  wrapper: ({ DefaultWidget, ...props }) => (
    <div>
      <div>Custom content above the default details widget</div>
      <DefaultWidget {...props} />
    </div>
  ),
})
```

Wrappers from different plugins nest, so two plugins can both add content
without either one disappearing. Two plugins using `addReplaceWidget` on the
same widget cannot, and JBrowse logs a warning naming the slot when that
happens.

:::caution Declare the wrapper outside the callback, or use `addWidgetWrapper`

```tsx
// this remounts the widget on every render
pluginManager.addToExtensionPoint('Core-replaceWidget', DefaultWidget => {
  return function NewWidget(props) {
    return <DefaultWidget {...props} />
  }
})

// use addWidgetWrapper instead, which builds the component once
addWidgetWrapper(pluginManager, {
  wrapper: ({ DefaultWidget, ...props }) => <DefaultWidget {...props} />,
})
```

`Core-replaceWidget` is re-evaluated on every render of the drawer, so returning
a component declared inside the callback hands React a brand new component type
each time. The widget inside is unmounted and remounted, losing its scroll
position, any text typed into it, and any panel the user had expanded.

:::

### Core-extraFeaturePanel

type: synchronous

Adds panels to the feature details widget, below the built-in Attributes and
Sequence sections. This is a `list` point: every plugin's panel is kept, in
registration order, so panels compose rather than overwrite.

Register with `addFeaturePanel`, which scopes the panel with the same selector
`addReplaceWidget` uses:

```tsx
import { addFeaturePanel } from '@jbrowse/core/ui'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'

addFeaturePanel(pluginManager, {
  select: { trackType: 'VariantTrack' },
  panel: ({ model, feature }) => (
    <BaseCard title="Extra info">{/* your content */}</BaseCard>
  ),
})
```

Your panel renders its own card chrome, so use `BaseCard` for a titled section.

- `select` - a `FeaturePanelSelector`, below. Omit it to add the panel to every
  track's feature details.
- `panel` - a `React.ComponentType<FeaturePanelProps>`.

<!-- include: packages/core/src/ui/addFeaturePanel.ts#selector -->

```typescript
export interface FeaturePanelSelector extends TrackSelectorFields {
  /** escape hatch; also has the `feature` being shown */
  where?: (props: FeaturePanelProps) => boolean
}
```

There is no `widgetType` here, unlike `WidgetSelector`: a feature detail
widget's type varies by track type, so `trackType` is the field that means "my
kind of track". `trackId` and `trackType` are documented under
[`Core-replaceWidget`](#core-replacewidget); a plain-string `trackId` matches
the user's copies of that track too.

`where` additionally receives the `feature` being shown and the `depth` of the
card it is being shown on, neither of which the declarative fields can reach.
The point fires once per card, including the nested card for every subfeature,
so `depth === 0` is how a panel says "only the feature the user clicked":

```tsx
addFeaturePanel(pluginManager, {
  select: {
    where: ({ feature, depth }) => feature.type === 'gene' && depth === 0,
  },
  panel: MyGenePanel,
})
```

Your panel receives the point's props:

<!-- include: packages/core/src/PluginManager.ts#featurePanelProps -->

```typescript
export interface FeaturePanelProps {
  /** has `trackId` and `trackType` */
  model: FeatureWidgetModel
  /** snapshot of the feature being shown */
  feature: SimpleFeatureSerialized
  /**
   * how far down the subfeature tree this card is: 0 is the feature the user
   * clicked, 1 its subfeatures, and so on. The point fires for every card, so a
   * panel that belongs only on the clicked feature selects on `depth === 0`
   */
  depth: number
}
```

`model` also has `track`, which is undefined if the user closed the track while
the widget was open; `trackId` and `trackType` stay defined either way. Derive
the session with `getSession(model)` if you need it.

If you fire this point yourself, or need a panel that decides per render, the
underlying contract is an accumulating array: `args` is
`React.ComponentType<FeaturePanelProps>[]`, empty by default, and each callback
appends to it and returns it. Dropping the spread removes every other plugin's
panel, which is the main reason to prefer the helper.

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

### Core-addTrackComponent

type: synchronous

- `args` - `ComponentType<AddTrackComponentProps>` - the picker rendered so far
- `props` - `{ model }` - the add-track widget model

Adapter-specific fields shown in the "Add track" widget, below the adapter and
track-type selectors. It is a single-component fold: return your own component
when the selected adapter is one you handle, and the accumulated component
otherwise.

Register with `addAddTrackComponent` (from `@jbrowse/core/util`), which states
only which adapters you claim:

<!-- include: plugins/gwas/src/GWASAddTrackComponent/index.tsx#register -->

```typescript
export default function GWASAddTrackComponentF(pluginManager: PluginManager) {
  addAddTrackComponent(pluginManager, {
    adapterTypes: ['GWASAdapter'],
    component: GWASAddTrackComponent,
  })
}
```

Your component writes the config fragments it collects to `model.mixinData`,
which the widget merges into the track config on submit. Write the whole
fragment on every edit (a later write replaces the previous one rather than
merging with it), and clear it on unmount, so switching to another adapter
doesn't leave stale fields behind.

### TrackSelector-multiTrackMenuItems

type: synchronous

- `args` - `MenuItem[]` - an array of items that you can accumulate on
- `props` - an object of the form below

```typescript
interface props {
  session: AbstractSessionModel
}
```

Add menu items to the "shopping cart" in the header of the hierarchical track
menu when tracks are added to the selection.

Example: Reference:
[`CreateMultiWiggleExtension`](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/CreateMultiWiggleExtension/index.ts),
which turns a multi-track selection into one multi-wiggle track.

### TrackSelector-folderDialog

type: synchronous

Replaces the dialog that opens when a user clicks a folder category (supertrack)
in the hierarchical track selector. The default shows a faceted track selector
scoped to that category; use this point to provide custom UI for a specific
category.

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
comma-joined path of category names from the track's `category` config field, so
`"category": ["Wiggle", "My Subcategory"]` produces
`categoryId = "Tracks-Wiggle,My Subcategory"`. Return the default component
unchanged for categories you don't handle.

### LaunchView-LinearGenomeView

type: async

Launches a linear genome view. Rarely extended directly, but a useful reference
for implementing a `LaunchView-*` point for your own view type. See
[](/docs/developer_guides/creating_view).

- `args` - an object of the format below

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

Reference:
[the LGV plugin's registration](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/index.ts).

### LaunchView-CircularView

type: async

Launches a circular view.

- `args` - an object of the format below

```typescript
interface args {
  session: AbstractSessionModel // the session model
  assembly: string // assembly name
  tracks: string[] // array of track IDs
}
```

Reference:
[the circular-view plugin's registration](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/index.ts).

### LaunchView-SvInspectorView

type: async

Launches an SV inspector.

- `args` - an object of the format below

```typescript
interface args {
  session: AbstractSessionModel // the session model
  assembly: string // assembly name
  uri: string // uri for file to load into the SV inspector
  fileType?: string // type of file referred to by the uri ("VCF"|"CSV"|"BEDPE",etc) if uri extension does not properly hint at the file type
}
```

Reference:
[the sv-inspector plugin's registration](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sv-inspector/src/index.ts).

### LaunchView-SpreadsheetView

type: async

Launches a spreadsheet view.

- `args` - an object of the format below

```typescript
interface args {
  session: AbstractSessionModel // the session model
  assembly: string // assembly name
  uri: string // uri for file to load into the spreadsheet view
  fileType?: string // type of file referred to by the uri ("VCF"|"CSV"|"BEDPE",etc) if uri extension does not properly hint at the file type
}
```

Reference:
[the spreadsheet-view plugin's registration](https://github.com/GMOD/jbrowse-components/blob/main/plugins/spreadsheet-view/src/index.ts).

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

Reference:
[`LaunchDotplotView`](https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/LaunchDotplotView.ts).

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

Reference:
[`LaunchLinearSyntenyView`](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LaunchLinearSyntenyView.ts).

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

Render a custom overlay inside the LinearGenomeView TracksContainer, e.g.
highlights as a full-height div over the tracks area. Append to the array and
return it.

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

Render custom overlays inside the overview scalebar, e.g. bookmark highlights.
Append to the array and return it.

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

Called when a search result is selected in the LinearGenomeView search box,
after navigation (if the result has a location). Useful for taking further
action, e.g. selecting a corresponding feature. It's a notification point: the
payload lives in `props` (passed unchanged to every callback) rather than
`args`, so callbacks can't alter what later callbacks see.

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

Add custom radio options to the DotplotView import form; selecting one renders
the plugin's React component. Each option:

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

Add support for new synteny file formats in the DotplotView import form. The
built-in formats (`.paf`, `.delta`, `.out`, `.chain`, `.anchors`,
`.anchors.simple`, `.pif.gz`) are the initial value; each callback appends to or
replaces entries. Each option:

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

Add custom radio options to the LinearSyntenyView import form. Same pattern as
`DotplotView-ImportFormSyntenyOptions`. Each option:

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

Register it the same way as `DotplotView-ImportFormSyntenyOptions` above,
appending your `{ value, label, ReactComponent }` option to the array.

### Desktop-StartScreenMenuItems

type: synchronous

- `args` - `MenuItem[]` - the start screen menu's items
- `props` - `{ pluginManager, setPluginManager, loadPluginManager }`

Desktop only. The start screen runs before any session exists, so these points
fire on a plugin manager built from the user's **global plugins** alone (the
ones in the "Global plugins" dialog) — a plugin listed only in a config is not
loaded yet and cannot extend this screen.

`loadPluginManager(configPath)` builds a session's plugin manager and
`setPluginManager` hands it to the app, so a menu item can open a session
itself:

```typescript
pluginManager.addToExtensionPoint(
  'Desktop-StartScreenMenuItems',
  (items, { setPluginManager, loadPluginManager }) => [
    ...items,
    {
      label: 'Open my thing...',
      onClick: () => {
        loadPluginManager(myConfigPath)
          .then(setPluginManager)
          .catch(console.error)
      },
    },
  ],
)
```

A callback that throws here costs the plugin its menu items only — the start
screen still renders, so the dialog that can uninstall a misbehaving global
plugin stays reachable.

### Desktop-StartScreenLaunchPanel

type: synchronous

- `args` - `ComponentType<StartScreenPanelProps>` - the "Launch new session"
  panel component
- `props` - `{ setPluginManager, loadPluginManager }`

Desktop only. Replace or wrap the panel, in the same single-component fold as
`Core-replaceWidget` — return your own component, or one that renders the
default with extra chrome around it. If it throws while rendering, the start
screen falls back to the built-in panel and shows an error above it.

### Desktop-StartScreenRecentSessionsPanel

type: synchronous

Same shape as `Desktop-StartScreenLaunchPanel`, for the recent sessions panel.

### Adding your own extension points

Fire any name with `evaluateExtensionPoint('YourCustomNameHere', value, props)`
and let other code register against it with `addToExtensionPoint` (see the API
section above). The `Core-` prefix just marks points from the core codebase;
choose your own prefix to avoid collisions.

## See also

- [](/docs/developer_guides/pluggable_elements)
- [](/docs/developer_guides/creating_view)
- [](/docs/developer_guides/menus)
- [](/docs/developer_guides/creating_addtrack_workflow)
