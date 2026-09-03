---
title: Extension points
description: Callbacks registered by producers and consumed across the app
guide_category: Core concepts
---

**TL;DR:** Extension points are named callback chains. A producer fires one with
`evaluateExtensionPoint`; plugins register callbacks with `addToExtensionPoint`,
each receiving the previous callback's return value. Points that accumulate a
list take `contributeToExtensionPoint` instead, where a callback returns only
its own entries, and points that only notify take `listenToExtensionPoint`,
where it returns nothing.

## Using extension points

A producer fires a point:

<!-- include: packages/core/src/extensionPointChaining.test.ts#fire -->

```typescript
const ret = pluginManager.evaluateExtensionPoint('ExtensionPointName', {
  value: 1,
})
```

Consumers register callbacks against the same point (multiple plugins can each
register one):

<!-- include: packages/core/src/extensionPointChaining.test.ts#register -->

```typescript
pluginManager.addToExtensionPoint(
  'ExtensionPointName',
  (arg: { value: number }) => {
    return { value: arg.value + 1 }
  },
)
```

Callbacks are chained: each receives the previous one's return value, so with
two such callbacks registered `ret` is `{value:3}`, as the test both snippets
come from asserts.

## TypeScript types for extension points

Built-in points are registered in the `ExtensionPointRegistry` interface in
`@jbrowse/core/PluginManager`. `addToExtensionPoint` / `evaluateExtensionPoint`
/ `evaluateAsyncExtensionPoint` narrow to the registered types when you pass a
known name, so callbacks get typed `args` and evaluate calls return the correct
type without a cast.

Register your own point the same way. The spreadsheet view's launcher is a
complete example — an exported args interface, then the augmentation naming it:

<!-- include: plugins/spreadsheet-view/src/LaunchSpreadsheetView/index.ts#registry -->

```typescript
export interface LaunchSpreadsheetViewArgs
  extends
    Omit<
      SnapshotIn<SpreadsheetViewStateModel>,
      | 'type'
      | 'init'
      | 'launch'
      | 'spreadsheet'
      | 'importWizard'
      | keyof SpreadsheetViewCommands
    >,
    SpreadsheetViewCommands {
  session: AbstractViewContainer
}

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'LaunchView-SpreadsheetView': {
      args: LaunchSpreadsheetViewArgs
      result: LaunchSpreadsheetViewArgs
    }
  }
}
```

Three things generalize from it:

- **`args` and `result` are the same type** on a point that threads one payload
  through, and a callback returns what it was given. A point that accumulates
  declares an array for both.
- **`props`**, the third and optional key, declares the context object passed
  unchanged to every callback — see [`Core-replaceWidget`](#core-replacewidget)
  for one that has it.
- **The `declare module` block** goes in any file that is part of your plugin's
  compilation; putting it beside the registration keeps the two from drifting.

### Points that resolve to UI

A point whose value is a component or an element names one of three shapes, so a
seam is one line: `'Core-extraFeaturePanel': ComponentList<FeaturePanelProps>`
is the whole declaration. The shape is also what decides which producer renders
the point and which helper registers on it:

<!-- include: packages/core/src/PluginManager.ts#uiShapes -->

```typescript
/**
 * A point that resolves to one component — a slot with a default, which a
 * plugin wraps or replaces. Declared as
 * `'Core-replaceWidget': ComponentSlot<ReplaceWidgetProps>`, produced by
 * {@link PluggableComponent}, registered on with `wrapComponent`.
 */
export interface ComponentSlot<P> {
  args: ComponentType<P>
  result: ComponentType<P>
  props: P
  /**
   * Type-only: never present at runtime, and what makes the shape *declared*
   * rather than guessed. Reading it off the value cannot work — a
   * `TrackTypeGuesser` takes an argument and returns a string, which is also
   * what a function component does, so a structural test admits it as a slot.
   */
  kind: 'componentSlot'
}

/**
 * A point that accumulates an array of components — the panel points. Produced
 * by {@link PluggableComponents}, registered on with
 * {@link PluginManager.contributeToExtensionPoint}; each panel scopes itself
 * and draws its own chrome.
 */
export interface ComponentList<P> {
  args: ComponentType<P>[]
  result: ComponentType<P>[]
  props: P
  /** type-only, see {@link ComponentSlot.kind} */
  kind: 'componentList'
}

/**
 * A point that accumulates already-rendered elements — the overlay points.
 * Produced by {@link PluggableElements}, registered on with
 * `addExtensionElement`, which fixes the React key at registration time.
 */
export interface ElementList<P> {
  args: ReactNode[]
  result: ReactNode[]
  props: P
  /** type-only, see {@link ComponentSlot.kind} */
  kind: 'elementList'
}
```

`args` alone cannot say which shape a point has: a `TrackTypeGuesser` takes an
argument and returns a string, which is what a function component does too, so a
structural test admits it as a wrappable slot. `kind` exists only in the type —
nothing sets it at runtime, and nothing reads it. `extensionPointShapes.test.ts`
pins each seam against the points of the other shapes, and fails a new
`ComponentList` or `ElementList` declared the long way, which would otherwise be
a point no producer accepts.

## API

```typescript
// props is an extra context object your callbacks receive, required for the
// points that declare one and omitted for the points that don't
pluginManager.evaluateExtensionPoint(extensionPointName, args, props)
pluginManager.evaluateAsyncExtensionPoint(extensionPointName, args, props)

pluginManager.addToExtensionPoint(extensionPointName, args => {
  return newArgs // passed as args to the next callback in the chain
})

// points whose args are an array take contributions instead, and never hand
// you the array — see "Accumulating points" below
pluginManager.contributeToExtensionPoint(extensionPointName, props => {
  return myEntry // or [myEntry, ...], or undefined to contribute nothing
})

// points whose args are `undefined` carry everything in props and read nothing
// back — see "Notification points" below
pluginManager.listenToExtensionPoint(extensionPointName, props => {
  react(props) // returns nothing; an async callback's promise reaches the producer
})

// a producer whose point resolves to UI fires it as JSX instead. One component
// per shape — see "Firing a point that renders" below
<PluggableComponent name={extensionPointName} component={Default} props={props} pluginManager={pluginManager} />
<PluggableComponents name={extensionPointName} props={props} pluginManager={pluginManager} />
<PluggableElements name={extensionPointName} props={props} pluginManager={pluginManager} />
```

Only `addToExtensionPoint` threads a value: each callback's return value becomes
the next callback's `args`. `props` is passed unchanged to every callback
whichever method registered it, and any of the three creates the point if it
doesn't exist yet. Each rejects the points the other two own, so the method you
can call is the one the point's shape calls for.

There is a fourth fire method, `evaluateAsyncExtensionPointStrict`, which is
`evaluateAsyncExtensionPoint` without the swallow-and-continue: a callback that
throws propagates to the producer instead of being logged. Every `LaunchView-`
point is fired that way, so a launcher that throws surfaces as an error to the
user rather than as an empty session. Producers of accumulating points want the
plain runner, where one plugin failing does not cost the others their entries.

These are the only signatures on this page that are not generated from source;
they name placeholder arguments so the seven read side by side.

## Registering on a point

### Accumulating points

Register on a `list` point with **`contributeToExtensionPoint`**. The callback
gets the props and returns what to add — one entry, an array, or `undefined` for
none. The GC content plugin, adding an item to the reference sequence track's
menu:

<!-- include: plugins/gccontent/src/extraTrackMenuItems.ts -->

```typescript
import { readConfObject } from '@jbrowse/core/configuration'
import { addExtraTrackMenuItems } from '@jbrowse/core/ui/buildExtraTrackMenuItems'
import {
  addAndShowTrack,
  isSessionWithAddSessionTrack,
} from '@jbrowse/core/util'
import { getConfAssemblyNames } from '@jbrowse/core/util/tracks'

import { makeGCContentTrackConf } from './makeGCContentTrackConf.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * Adds an "Add GC content track" item to the reference sequence track's menu in
 * the hierarchical track selector (where there's no open display to host the
 * action). Uses the shared Core-extraTrackMenuItems extension point so the
 * track-selector code stays decoupled from this plugin.
 */
export default function GCContentExtraTrackMenuItemsF(
  pluginManager: PluginManager,
) {
  addExtraTrackMenuItems(pluginManager, ({ session, config, view }) =>
    readConfObject(config, 'type') === 'ReferenceSequenceTrack' &&
    isSessionWithAddSessionTrack(session)
      ? {
          label: 'Add GC content track',
          onClick: () => {
            const conf = makeGCContentTrackConf({
              assemblyNames: getConfAssemblyNames(config),
              sequenceAdapter: readConfObject(config, 'adapter'),
              gcMode: 'content',
            })
            addAndShowTrack(session, conf, view)
          },
        }
      : undefined,
  )
}
```

The concatenation happens once inside the plugin manager, and a callback never
sees the accumulated array, so no plugin can drop another plugin's entries.
`addToExtensionPoint` covers the points that thread a single value, and
type-errors on a `list` point.

For `list` points that accumulate rendered elements, register with
`addExtensionElement`, which fixes the React `key` for you:

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

### wrapComponent: filling a component slot {#wrapcomponent-the-one-way-to-fill-a-slot}

A point declared [`ComponentSlot`](#points-that-resolve-to-ui) resolves to one
component, and `wrapComponent`, from `@jbrowse/core/ui`, is how a plugin fills
it. Your component is handed whatever fills the slot so far as
`DefaultComponent`: render it and you have added to the default, leave it out
and you have replaced it. There is no separate "replace" call, and writing it
this way lets the next plugin still wrap yours.

<!-- include: packages/core/src/ui/PluggableComponent.test.tsx#wrapComponent -->

```tsx
wrapComponent(pm, 'Core-replaceWidget', ({ DefaultComponent, ...rest }) => (
  <div>
    <div>custom</div>
    <DefaultComponent {...rest} />
  </div>
))
```

It takes the point's name, so the same call fills any single-component slot:
`Core-replaceAbout` and the desktop start-screen panels work exactly like this.

Wrappers from different plugins nest, so two plugins can both add content
without either one disappearing. Two callbacks registered on the point by hand
cannot, and JBrowse logs a warning naming the slot when that happens.

### matchesTrackSelector: which tracks a contribution is for

Every track-scoped point fires for every track, so a contribution that does not
say which tracks it wants applies to all of them — a wrapper takes over every
widget that opens, a panel appears on every feature. `matchesTrackSelector`,
also from `@jbrowse/core/ui`, answers whether the props you were handed belong
to a track `select` names. What you do with the answer depends on the point:

- a **wrapper** renders the component it was handed
- a **panel** renders `null`
- a **data transform** returns its argument unchanged

<!-- include: packages/core/src/ui/PluggableComponent.test.tsx#replaceWidget -->

```tsx
function scopedToOneTrack(pm: PluginManager) {
  wrapComponent(pm, 'Core-replaceWidget', ({ DefaultComponent, ...rest }) =>
    matchesTrackSelector({ trackId: 'volvox.inv.vcf' }, rest) ? (
      <div>mine</div>
    ) : (
      <DefaultComponent {...rest} />
    ),
  )
}
```

`select` accepts any combination of the fields below, and all of the ones you
give must match. An empty selector matches everything.

<!-- include: packages/core/src/ui/extensionSelectors.ts#fields -->

```typescript
export interface TrackSelector {
  /** track type, e.g. `'VariantTrack'`, usually what "for my tracks" means */
  trackType?: string | string[]
  /** track id; a plain string also matches the user's copies of that track */
  trackId?: string | RegExp | (string | RegExp)[]
  /** widget model type, e.g. `'AlignmentsFeatureWidget'`, for the slot points */
  widgetType?: string | string[]
}
```

Prefer `trackType` when what you mean is "my kind of track". A plain-string
`trackId` also matches the user's copies of that track (the "Copy track" menu
item appends a timestamp to the id), so scoping by id does not silently stop
applying the first time someone copies the track. Pass a `RegExp` if you want to
control the matching yourself.

It reads either the widget model these points carry or the track config the
About points carry, so one call scopes a contribution to any of them — including
[`Core-customizeAbout`](#core-customizeabout), which transforms a config and
renders nothing. Anything the fields cannot express joins the same condition;
the panel below adds `depth` to it.

Don't reach for `matchTrackId` from `@jbrowse/core/util` — that one tests an id
against patterns you supply, so the copy-track normalization is back to being
yours to remember.

Matching is on the model because the config that produced a feature details
widget isn't always retrievable.

:::caution Declare the wrapper outside the callback, or use `wrapComponent`

<!-- include: packages/core/src/ui/PluggableComponent.test.tsx#inlineComponent -->

```tsx
pm.addToExtensionPoint('Core-replaceWidget', Default => {
  // declared inside the callback, so every evaluation is a new component type
  return function NewWidget(props: ReplaceWidgetProps) {
    return (
      <div>
        <div>custom</div>
        <Default {...props} />
      </div>
    )
  }
})
```

Use [`wrapComponent`](#wrapcomponent-the-one-way-to-fill-a-slot) instead, which
builds the wrapped component once and caches it.

`Core-replaceWidget` is re-evaluated on every render of the drawer, so returning
a component declared inside the callback hands React a brand new component type
each time. The widget inside is unmounted and remounted, losing its scroll
position, any text typed into it, and any panel the user had expanded.

:::

### Firing a point that renders

A producer whose point resolves to UI fires it as JSX from `@jbrowse/core/ui`.
One component per shape, all three shown in the API block above:

- `PluggableComponent` for a `single` point, where `component` is the default
  the slot resolves to when no plugin claims it.
- `PluggableComponents` for a `list` point whose entries are components — the
  panel points. It renders each one with the point's props, inside its own
  `<Suspense>`, so a panel can be `React.lazy`.
- `PluggableElements` for a `list` point whose entries are already-rendered
  `ReactNode`s — the overlay points.

All three are observers, so a contributor that scopes itself on an observable is
re-evaluated when that observable changes. Which one a point takes is decided by
its registry entry: each accepts only the points of its own shape, so pointing
one at another's point is a compile error rather than a component that renders
nothing.

A point fired this way has no string-literal call site, so its `#extensionPoint`
docs tag goes on its `ExtensionPointRegistry` entry instead.

### Notification points

A point declaring `args: undefined` carries its whole payload in `props` and
reads nothing back. Register on it with **`listenToExtensionPoint`**, whose
callback returns nothing:

<!-- include: plugins/canvas/src/index.ts#searchResultSelected -->

```typescript
pluginManager.listenToExtensionPoint(
  'LinearGenomeView-searchResultSelected',
  ({ result, model, assemblyName }) => {
    highlightSearchResultFeature({ result, model, assemblyName })
  },
)
```

Every callback registered on a notification point runs — there is no value for a
later one to overwrite. That is what the `notify` shape in the listing below
means.

`addToExtensionPoint` rejects these names because of the promise handling. An
`async` callback's promise is the point's completion signal, and two of them are
**joined**, so a producer waiting on the folded value learns when every handler
has finished. A hand-written callback that returns its own promise gets that
wrong, and gets it wrong invisibly: the symptom is a producer that stops waiting
early, which reads as a race rather than as the wrong registration method.

That is how `Core-handleUnrecognizedAssembly` works — a handler supplies the
assembly out of band, and its promise is what lets `waitForAssembly` stop
waiting on an event rather than on a clock. The producer there fires the point
with the **sync** runner and awaits the folded value itself; only
`evaluateAsyncExtensionPoint` awaits each callback in turn.

## Extension point listing

Generated from the `#extensionPoint` tags at each point's fire/registration
site. The detailed sections that follow are hand-written.

**Shape** says what happens when a second plugin registers on the same point,
and is derived from the point's `args`:

- **`list`** accumulates, so every plugin's contribution survives; register with
  `contributeToExtensionPoint`.
- **`notify`** carries no value at all, so every plugin's callback runs;
  register with `listenToExtensionPoint`.
- **`single`** threads one value along, so each callback overwrites what the one
  before it returned and only the last plugin to register is visible; register
  with `addToExtensionPoint`.

The names don't carry this: `Desktop-StartScreenMenuItems` accumulates and
`Desktop-StartScreenLaunchPanel` does not. Check the Shape column before
registering — a `single` point is a slot, and taking it hides whatever the
plugin before you put there.

<!-- EXTENSION_POINTS_INDEX START -->

<!-- prettier-ignore -->
| Extension point | Type | Shape | Description |
| --- | --- | --- | --- |
| `Core-addTrackComponent` | sync |  | Inject a custom React component into the add-track widget |
| `Core-addTrackComponentAdapterTypes` | sync | list | Adapter types whose add-track picker supplies the assembly |
| `Core-customizeAbout` | sync | single | Transform the config shown in a track's About dialog |
| `Core-extendPluggableElement` | sync | single | Mutate any pluggable element after it is created |
| `Core-extendSession` | sync | single | Extend the session model with extra state or actions |
| `Core-extendWorker` | sync | single | Take a booted RPC web worker: subscribe to the events it emits, post to it, or wrap its `call`. Fired once per booted worker, not per call |
| `Core-extraAboutPanel` | sync |  | Add extra panels to a track's About dialog |
| `Core-extraFeaturePanel` | sync |  | Add extra panels to the feature details widget |
| `Core-extraTrackMenuItems` | sync | list | Add items to a single track's menu |
| `Core-guessAdapterForLocation` | sync | single | Guess an adapter config from a file location |
| `Core-guessTrackTypeForLocation` | sync | single | Guess a track type from a file location |
| `Core-handleUnrecognizedAssembly` | sync | notify | Supply an assembly config when a referenced assembly is unknown. May return a promise settling when the handler has finished trying, which is what lets waitForAssembly stop waiting without a timeout |
| `Core-preferencesDialogPanels` | sync | list | Add panels to the preferences dialog |
| `Core-preProcessTrackConfig` | sync | single | Rewrite a track config snapshot before it is instantiated |
| `Core-replaceAbout` | sync |  | Replace or wrap a track's About dialog body |
| `Core-replaceWidget` | sync |  | Replace or wrap the component that renders a widget |
| `Desktop-StartScreenLaunchPanel` | sync |  | Replace or wrap the "Launch new session" panel |
| `Desktop-StartScreenMenuItems` | sync | list | Add items to the start screen menu |
| `Desktop-StartScreenRecentSessionsPanel` | sync |  | Replace or wrap the recent sessions panel |
| `DotplotView-ImportFormSyntenyOptions` | sync | list | Add options to the dotplot view import form |
| `DotplotView-OverlayHTMLComponent` | sync |  | Add an HTML overlay component to the dotplot view |
| `DotplotView-OverlaySVGComponent` | sync |  | Add an SVG overlay component to the dotplot view |
| `DotplotView-SyntenyFileFormats` | sync | list | Add synteny file formats to the dotplot import form |
| `LaunchView-BreakpointSplitView` | async | single | Programmatically launch a breakpoint split view |
| `LaunchView-CircularView` | async | single | Programmatically launch a circular view |
| `LaunchView-DotplotView` | async | single | Programmatically launch a dotplot view |
| `LaunchView-LinearGenomeView` | async | single | Programmatically launch a linear genome view |
| `LaunchView-LinearSyntenyView` | async | single | Programmatically launch a linear synteny view |
| `LaunchView-SpreadsheetView` | async | single | Programmatically launch a spreadsheet view |
| `LaunchView-SvInspectorView` | async | single | Programmatically launch the SV inspector view |
| `LinearGenomeView-HighlightSVGComponent` | sync |  | Add an SVG highlight overlay in the LGV SVG export |
| `LinearGenomeView-OverviewScalebarComponent` | sync |  | Add a component to the overview scalebar |
| `LinearGenomeView-ScalebarHighlightComponent` | sync |  | Add a highlight component to the scalebar |
| `LinearGenomeView-searchResultSelected` | async | notify | Invoked when a search result is selected |
| `LinearGenomeView-TracksContainerComponent` | sync |  | Add a component into the LGV tracks container |
| `LinearSyntenyView-ImportFormSyntenyOptions` | sync | list | Add options to the linear synteny view import form |
| `LinearSyntenyView-SyntenyFileFormats` | sync | list | Add synteny file formats to the linear synteny import form |
| `TrackSelector-folderDialog` | sync |  | Replace the dialog shown when a folder category is clicked |
| `TrackSelector-multiTrackMenuItems` | sync | list | Add items to the multi-track (shopping cart) menu |

<!-- EXTENSION_POINTS_INDEX END -->

### Core-extendPluggableElement

type: synchronous

- `args` - `PluggableElementType` - the pluggable element being installed
- `props` - `{ group }`, which of the ten kinds it is (`'view'`, `'display'`,
  `'adapter'`, …)

Add functionality to pluggable elements, e.g. extra right-click context menus.
Your callback receives **every** pluggable element registered to the system, so
it must select the one it means.

Most view and display types register their state model lazily. For those the
point fires when the state model loads rather than at startup, so
`elt.stateModel = extend(elt.stateModel)` in the callback sees a loaded model
and works the way it did in v4. A callback that instead changes something the
host reads before any model loads, such as a display's `configSchema`, runs too
late for a lazy element.

For the two common cases use `extendViewType` / `extendDisplayType`, which check
the `group` and look the name up in a registry:

<!-- include: products/jbrowse-react-linear-genome-view/examples-site/src/examples/WithDisableZoomAndSideScroll.tsx#extend -->

```tsx
extendViewType(pluginManager, 'LinearGenomeView', stateModel =>
  types.compose(
    stateModel,
    types.model().actions(() => ({
      zoomTo: () => {},
      scrollTo: () => {},
    })),
  ),
)
```

`stateModel` arrives typed, so `self` is typed through the rest of the chain
with no `as`. The name is checked too: register your view or display in the
registry beside its state model type, and a typo or a rename becomes a compile
error instead of an extension that silently stops applying.

Both take an array of names as well as one, which is how a contribution reaches
a family of displays — a family here is a shared mixin set rather than a chain,
so there is no parent type to name.

For the commonest reason to reach for these — adding an entry to somebody else's
menu — go one level higher still and use `addViewMenuItems` /
`addDisplayMenuItems`, which own the super-capture and the concatenation. See
[Adding track context-menu items](/docs/developer_guides/menus#adding-track-context-menu-items).
Extend the state model when the contribution needs state or actions of its own,
so the menu items and what they call stay in one place.

<!-- include: plugins/linear-genome-view/src/LinearGenomeView/model.ts#registry -->

```typescript
declare module '@jbrowse/core/PluginManager' {
  interface ViewTypeRegistry {
    LinearGenomeView: LinearGenomeViewStateModel
  }
}
```

See [](/docs/developer_guides/menus) for a worked example adding track
context-menu items.

### Core-guessAdapterForLocation

type: synchronous

- `args` - `AdapterGuesser` - the guesser accumulated so far

Infer an adapter type from a location in the "Add track" workflow. See the
[add track workflow guide](/docs/developer_guides/creating_addtrack_workflow).

The formats JBrowse ships with are rows in `@jbrowse/add-track-core`'s table —
filename regex, adapter type, location field, index layout, track type — which
`CorePlugin` guesses from and `@jbrowse/cli`'s `add-track` reads too, so a file
resolves to the same adapter config in the app and on the command line. Core
guesses a row only when `pluginManager.hasAdapterType` says the build has that
adapter, so a build without the alignments plugin still guesses nothing for a
`.bam`. Register on this point to add a format the table does not describe.

Use `addAdapterGuesser` rather than calling `addToExtensionPoint` directly:
these two points are chains of responsibility, where each callback wraps the
previously registered guesser and delegates to it when it has no match. The
helper does that wiring, so your callback just returns a config when it
recognizes the file and `undefined` when it doesn't. Delegating by hand is easy
to get subtly wrong: dropping the optional `file` argument on the way through
hides it from every guesser registered before yours.

The chain is first-match-wins, so it returns exactly one adapter and cannot
express "or this other one". Where two adapters genuinely read the same
extension, the one the chain does not pick declares that on its own
registration, and the "Add track" form offers it alongside the guess:

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

A plugin adding a format registers both together, one guessing the adapter and
one naming the track type to draw it with. The `file` argument is what lets one
adapter serve two track types — a `.bedmethyl.gz` and a plain `.bed.gz` are both
read by `BedTabixAdapter`:

<!-- include: packages/core/src/util/formatGuessers.ts#installFormatGuessers -->

```typescript
export function installFormatGuessers(pluginManager: PluginManager) {
  addAdapterGuesser(pluginManager, (file, index, adapterHint) => {
    const spec = matchFormat(getFileName(file), adapterHint)?.spec
    return spec &&
      'adapterType' in spec &&
      pluginManager.hasAdapterType(spec.adapterType)
      ? adapterConfigFromSpec(spec, file, index)
      : undefined
  })
  addTrackTypeGuesser(pluginManager, (adapterName, file) =>
    pluginManager.hasAdapterType(adapterName)
      ? trackTypeForAdapter(adapterName, file && getFileName(file))
      : undefined,
  )
}
```

### Core-extendSession

type: synchronous

Extend the session model itself with new features.

- `args` - `IAnyModelType` - the session model type, not an instance. Callbacks
  compose: each one builds on the model the one before it returned.

### Core-replaceAbout

type: synchronous

Provide a different component for the "About this track" dialog.

- `args` - a `ReactComponent`, by default the AboutTrack dialog
- `props` - `AboutPanelProps`, shared by all three About points:

<!-- include: packages/product-core/src/ui/util.ts#aboutPanelProps -->

```typescript
export type AboutConfig = AnyConfigurationModel | Record<string, unknown>

export interface AboutPanelProps {
  session: AbstractSessionModel
  config: AboutConfig
}
```

No in-tree plugin registers on any of the three: a track that wants to change
its own About dialog sets the `formatAbout` config slot. These are the
programmatic equivalent, for tracks you do not own.

All three are declared together — one accumulates an array, the other two thread
a single value:

<!-- include: packages/product-core/src/ui/util.ts#aboutRegistry -->

```typescript
// Augmentation lives here (not in the consuming components) because
// AboutDialogContents imports from this module, so the registry entries are
// visible wherever these points are evaluated — including getAboutDialogConfig
// below, which then needs no cast on the Core-customizeAbout result.
declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'Core-extraAboutPanel': ComponentList<AboutPanelProps>
    // fired via PluggableComponent's `name` prop, so there is no string-literal
    // call site and the docs tag lives here at the contract
    /** #extensionPoint Core-replaceAbout | sync | Replace or wrap a track's About dialog body */
    'Core-replaceAbout': ComponentSlot<AboutPanelProps>
    // data transform: mutate the config object shown in the dialog
    'Core-customizeAbout': {
      args: { config: Record<string, unknown> }
      result: {
        config: { metadata?: Record<string, unknown>; [key: string]: unknown }
      }
      props: AboutPanelProps
    }
  }
}
```

A single-component slot, so it is filled with
[`wrapComponent`](#wrapcomponent-the-one-way-to-fill-a-slot) exactly as
`Core-replaceWidget` is. Example: a new About dialog for one track, leaving
every other track's alone.

<!-- include: packages/product-core/src/ui/aboutExtensionPoints.test.tsx#replaceAbout -->

```typescript
function addReplaceAbout(pluginManager: PluginManager) {
  wrapComponent(
    pluginManager,
    'Core-replaceAbout',
    ({ DefaultComponent, ...rest }) =>
      matchesTrackSelector({ trackId: 'volvox_sv_test' }, rest) ? (
        <div>my about dialog</div>
      ) : (
        <DefaultComponent {...rest} />
      ),
  )
}
```

### Core-extraAboutPanel

type: synchronous

Adds extra panels to the "About this track" dialog, rendered below the built-in
Configuration/Metadata cards. This is a `list` point, like
[`Core-extraFeaturePanel`](#core-extrafeaturepanel): `args` is an accumulating
array of components, empty by default, and every plugin's panel is kept in
registration order.

- `args` - `ComponentType<AboutPanelProps>[]`, `[]` by default
- `props` - [`AboutPanelProps`](#core-replaceabout), also passed to your
  component

Return value: your component, or `undefined` to add no panel — the array itself
is never in reach, so nothing you return can drop another plugin's panel. Each
panel renders its own card chrome, so use `BaseCard` for a titled section.

Example: adds an extra about dialog panel for a particular track ID

<!-- include: packages/product-core/src/ui/aboutExtensionPoints.test.tsx#extraAboutPanel -->

```tsx
function ExtraAboutPanel(props: AboutPanelProps) {
  return matchesTrackSelector({ trackId: 'volvox_sv_test' }, props) ? (
    <BaseCard title="Extra">…</BaseCard>
  ) : null
}

function addExtraAboutPanel(pluginManager: PluginManager) {
  pluginManager.contributeToExtensionPoint(
    'Core-extraAboutPanel',
    () => ExtraAboutPanel,
  )
}
```

`ExtraAboutPanel` there is declared at module scope and renders its own card
chrome (`BaseCard`, from
`@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard`, gives a titled
section). Declaring it inside the callback instead makes it a new element type
on each evaluation, so the panel remounts and loses its state. Panels render
inside a `<Suspense>`, so `React.lazy` is fine.

The dialog fires this for whatever track was opened, so a panel that renders
unconditionally lands on every track's About dialog.
[`matchesTrackSelector`](#matchestrackselector-which-tracks-a-contribution-is-for)
is how it says which tracks it is for, the same way a feature panel does — and
it reads the track config these points carry rather than a widget model, so a
`trackId` selector here also matches the user's copies of that track.

### Core-customizeAbout

type: synchronous

Transform the config snapshot shown in the "About this track" dialog, after any
`formatAbout` config has been applied.

- `args` - an object of the form `{ config: Record<string, unknown> }`, the
  track config snapshot with `formatAbout` already merged in
- `props` - [`AboutPanelProps`](#core-replaceabout)

Return value: an object of the same `{ config }` shape, with your modifications

The dialog fires this for whatever track was opened, so returning a modified
config unconditionally rewrites every track's. This point renders nothing, so
there is no wrapper to scope — ask
[`matchesTrackSelector`](#matchestrackselector-which-tracks-a-contribution-is-for)
and return `arg` untouched when the answer is no.

Example: add a derived field to a particular track's about dialog

<!-- include: packages/product-core/src/ui/aboutExtensionPoints.test.tsx#customizeAbout -->

```typescript
function addCustomizeAbout(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint('Core-customizeAbout', (arg, { config }) =>
    // every track-scoped point scopes itself with the same predicate
    matchesTrackSelector({ trackId: 'volvox_sv_test' }, { config })
      ? { config: { ...arg.config, 'Custom field': 'Custom value' } }
      : arg,
  )
}
```

### Core-replaceWidget

type: synchronous

Provide a different component for a given widget, drawer, or modal. This is a
`single` point, since one widget renders: a callback returns its own component
to take the slot, or the accumulated one to opt out.
[`Core-extraFeaturePanel`](#core-extrafeaturepanel) is the point for _adding_ a
panel to a feature details widget.

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

Nothing in this repo registers on it: a display that wants its own feature
details widget names one with a `featureWidgetType` getter instead. Reach for
this point to replace a widget you do **not** own.

This point fires whenever **any** widget opens, so a callback that does not
scope itself takes over the drawer, the modal, and every feature details panel.
Fill it with [`wrapComponent`](#wrapcomponent-the-one-way-to-fill-a-slot) and
scope it with
[`matchesTrackSelector`](#matchestrackselector-which-tracks-a-contribution-is-for),
which are how every component slot is filled and scoped.

### Core-extraFeaturePanel

type: synchronous

Adds panels to the feature details widget, below the built-in Attributes and
Sequence sections. This is a `list` point: every plugin's panel is kept, in
registration order, so panels compose.

Register with `contributeToExtensionPoint`, returning your component. The
score-example plugin's panel, which reports the value its display draws:

<!-- include: example-plugins/score-example/src/ScoreFeaturePanel/index.tsx#register -->

```tsx
export default function ScoreFeaturePanelF(pluginManager: PluginManager) {
  pluginManager.contributeToExtensionPoint(
    'Core-extraFeaturePanel',
    () => ScoreFeaturePanel,
  )
}
```

Return value: your component, or `undefined` to add no panel.

The point fires for every feature details widget there is, so the panel says
which tracks it belongs on itself, with the same
[`matchesTrackSelector`](#matchestrackselector-which-tracks-a-contribution-is-for)
the widget points use. It renders its own card chrome too, so it starts at
`BaseCard`:

<!-- include: example-plugins/score-example/src/ScoreFeaturePanel/index.tsx#panel -->

```tsx
function ScoreFeaturePanel(props: FeaturePanelProps) {
  const { feature, depth } = props
  return depth === 0 &&
    feature.score !== undefined &&
    matchesTrackSelector({ trackType: 'FeatureTrack' }, props) ? (
    <BaseCard title="Score">
      <div>{String(feature.score)}</div>
    </BaseCard>
  ) : null
}
```

`widgetType` means nothing here: a feature detail widget's type varies by track
type, so `trackType` is the field that means "my kind of track". A plain-string
`trackId` matches the user's copies of that track too.

The `feature` being shown and the `depth` of the card showing it are what no
selector can reach, and both are ordinary conditions around the panel's own JSX,
as above. The point fires once per card, including the nested card for every
subfeature, so `depth === 0` is how a panel says "only the feature the user
clicked".

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
underlying contract is an accumulating array — `args` is
`React.ComponentType<FeaturePanelProps>[]`, empty by default — registered on
with [`contributeToExtensionPoint`](#accumulating-points). The helper is still
the better default: it does the track scoping, which nothing else can do for
you.

### Core-preProcessTrackConfig

type: synchronous

Rewrite a track config snapshot before it is instantiated. Registered contract:

<!-- include: packages/core/src/pluggableElementTypes/models/migrateTrackConfig.ts#registry -->

```typescript
interface DisplayConfigSnapshot {
  type?: string
  [key: string]: unknown
}
export interface TrackConfigSnapshot {
  displays?: DisplayConfigSnapshot[]
  [key: string]: unknown
}

// A data transform, not a component fold: each callback receives the previous
// callback's rewritten snapshot. The snapshot is already a defensive clone at
// both fire sites, so a callback may return a mutated `snap` as well as a new
// object.
declare module '../../PluginManager.ts' {
  interface ExtensionPointRegistry {
    'Core-preProcessTrackConfig': {
      args: TrackConfigSnapshot
      result: TrackConfigSnapshot
    }
  }
}
```

The snapshot is an open record because the point fires before anything validates
it. Return a new snapshot (or the mutated one; both fire sites clone first).
This declaration lives inside core, so it augments the module by relative path;
a plugin writes `declare module '@jbrowse/core/PluginManager'` for the same
effect.

For the common case — migrating a _display's_ config across a format change —
register through `addDisplayConfigMigration` rather than by hand:

<!-- include: plugins/wiggle/src/MultiLinearWiggleDisplay/preProcessTrackConfig.ts -->

```typescript
import { addDisplayConfigMigration } from '@jbrowse/core/pluggableElementTypes/models'

import { remapMultiWiggleRendering } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// MultiLinearWiggleDisplay's legacy single-source `defaultRendering` remap
// (e.g. "xyplot" -> "multixyplot") rewrites the value of a constrained enum
// slot, so it must run before the display types.union validates the snapshot —
// the config-schema preProcessSnapshot alone does not (see
// addDisplayConfigMigration).
export default function MigrateMultiWiggleConfigF(
  pluginManager: PluginManager,
) {
  addDisplayConfigMigration(
    pluginManager,
    ['MultiLinearWiggleDisplay'],
    remapMultiWiggleRendering,
  )
}
```

That helper walks `snap.displays` for you and only calls your `migrate` for the
display types you name, so unrelated tracks pass through untouched. Use it — not
a config-schema `preProcessSnapshot` — whenever the migration rewrites the
**value** of an existing constrained slot: a `types.union` tests the raw
snapshot, so it rejects the legacy value before a schema-level preprocessor ever
runs. Adding, removing, or renaming a slot does not need this, since the union
ignores props it doesn't know. Pass every type name the display answers to
(canonical plus aliases), and make `migrate` idempotent — it also fires from the
config-schema `preProcessSnapshot` on a direct create.

### Core-addTrackComponent

type: synchronous

- `args` - `ComponentType<AddTrackComponentProps>` - the picker rendered so far
- `props` - `{ model }` - the add-track widget model

Adapter-specific fields shown in the "Add track" widget, below the adapter and
track-type selectors. It is a single-component fold: return your own component
when the selected adapter is one you handle, and the accumulated component
otherwise.

Register with `addAddTrackComponent` (from `@jbrowse/core/util`) rather than
with [`wrapComponent`](#wrapcomponent-the-one-way-to-fill-a-slot), which is the
general way to fill a slot. This is the one slot with its own entry point, and
it earns it by writing two points from one declaration of your adapter types:
the fold here, and `Core-addTrackComponentAdapterTypes`, a plain list of the
same claims for callers that have an adapter name and no model.

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

Registered contract:

<!-- include: packages/core/src/ui/multiTrackMenuItems.ts#multiTrackMenuItems -->

```typescript
// lets plugins act on the whole checked selection in the hierarchical
// track selector's shopping-cart menu
'TrackSelector-multiTrackMenuItems': {
  args: MenuItem[]
  result: MenuItem[]
  props: MultiTrackMenuItemsProps
}
```

Add menu items to the "shopping cart" in the header of the hierarchical track
menu when tracks are added to the selection.

`CreateMultiWiggleExtension`, which turns a multi-track selection into one
multi-wiggle track, is the whole registration:

<!-- include: plugins/wiggle/src/CreateMultiWiggleExtension/index.ts#register -->

```typescript
export default function CreateMultiWiggleExtensionF(pm: PluginManager) {
  addMultiTrackMenuItems(pm, ({ session }) =>
    // contributing nothing is `undefined`, not an empty array to spread into
    // someone else's — the accumulated items are not this callback's to see
    isSessionWithAddSessionTrack(session)
      ? {
          label: 'Create multi-wiggle track...',
          onClick: (model: TrackSelectorSelf) => {
            getDialogHost(model).queueDialog(handleClose => [
              ConfirmDialog,
              {
                tracks: model.selection,
                onClose: (result?: MakeTrackArg) => {
                  if (result) {
                    makeTrack({ model, arg: result })
                  }
                  handleClose()
                },
              },
            ])
          },
        }
      : undefined,
  )
}
```

A plugin whose item does not apply returns `undefined`.

### TrackSelector-folderDialog

type: synchronous

Replaces the dialog that opens when a user clicks a folder category (supertrack)
in the hierarchical track selector. The default shows a faceted track selector
scoped to that category; use this point to provide custom UI for a specific
category.

- `args` - a React component (the default `DefaultFolderDialog`)
- `props` - `FolderDialogProps`

Fill it with [`wrapComponent`](#wrapcomponent-the-one-way-to-fill-a-slot), the
same call every component slot takes, and render the default you were handed for
the categories you do not want. Return value: a React component rendered as the
dialog. It receives the same `FolderDialogProps` the point was fired with:

<!-- include: plugins/data-management/src/HierarchicalTrackSelectorWidget/components/tree/TrackCategory.tsx#folderDialogProps -->

```typescript
export interface FolderDialogProps {
  model: HierarchicalTrackSelectorModel
  /** e.g. "Tracks-Wiggle,My Subcategory" */
  categoryId: string
  /** display name of the category */
  title: string
  /** flat list of every track node under this category, recursively */
  subtracks: TreeTrackNode[]
  handleClose: () => void
}
```

The `categoryId` format is `Tracks-{categoryPath}`, where `categoryPath` is the
comma-joined path of category names from the track's `category` config field, so
`"category": ["Wiggle", "My Subcategory"]` produces
`categoryId = "Tracks-Wiggle,My Subcategory"`.

### LaunchView points

type: async

One point per launchable view type, named `LaunchView-` plus the view type.
`loadSessionSpec` fires it with the spec's view object as its args plus
`session`, and the launcher forwards that object to `addView`, where the view's
own `preProcessSnapshot` sorts the launch keys from the properties. A view type
with no registered point cannot be launched from a spec, and `loadSessionSpec`
reports that by name rather than failing silently.

Register one to make your own view type launchable — see
[](/docs/developer_guides/creating_view). A second callback on a built-in one
sees the launch args the chain passes along, rather than the view the first
callback created.

Each launcher's args are that view type's spec fields, documented once in the
URL parameter guide and typed by the `Launch*Args` interface exported beside the
registration:

<!-- LAUNCH_VIEW_POINTS START -->

<!-- prettier-ignore -->
| Extension point | Spec fields | Args type |
| --- | --- | --- |
| `LaunchView-BreakpointSplitView` | [Breakpoint split view](/docs/urlparams#breakpoint-split-view) | [`LaunchBreakpointSplitViewArgs`](https://github.com/GMOD/jbrowse-components/blob/main/plugins/breakpoint-split-view/src/LaunchBreakpointSplitView/index.ts) |
| `LaunchView-CircularView` | [Circular view](/docs/urlparams#circular-view) | [`LaunchCircularViewArgs`](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/LaunchCircularView/index.ts) |
| `LaunchView-DotplotView` | [Dotplot view](/docs/urlparams#dotplot-view) | [`LaunchDotplotViewArgs`](https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/LaunchDotplotView.ts) |
| `LaunchView-LinearGenomeView` | [Linear genome view](/docs/urlparams#linear-genome-view) | [`LaunchLinearGenomeViewArgs`](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-genome-view/src/LaunchLinearGenomeView/index.ts) |
| `LaunchView-LinearSyntenyView` | [Linear synteny view](/docs/urlparams#linear-synteny-view) | [`LaunchLinearSyntenyViewArgs`](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LaunchLinearSyntenyView.ts) |
| `LaunchView-SpreadsheetView` | [Spreadsheet view](/docs/urlparams#spreadsheet-view) | [`LaunchSpreadsheetViewArgs`](https://github.com/GMOD/jbrowse-components/blob/main/plugins/spreadsheet-view/src/LaunchSpreadsheetView/index.ts) |
| `LaunchView-SvInspectorView` | [SV inspector](/docs/urlparams#sv-inspector) | [`LaunchSvInspectorViewArgs`](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sv-inspector/src/LaunchSvInspectorView/index.ts) |

<!-- LAUNCH_VIEW_POINTS END -->

Two spec keys never reach a launcher:

- **`type`** is the dispatch key.
- **`displayName`** is applied by `loadSessionSpec` to whatever view the launch
  created, so it works for plugin-provided types whose launcher never heard of
  it.

`id` is each launcher's own job, and every one above honors it.

### LinearGenomeView-TracksContainerComponent

type: synchronous

Registered contract, an accumulator of nodes rendered inside the TracksContainer
div:

<!-- include: plugins/linear-genome-view/src/LinearGenomeView/index.ts#tracksContainer -->

```typescript
/** #extensionPoint LinearGenomeView-TracksContainerComponent | sync | Add a component into the LGV tracks container */
'LinearGenomeView-TracksContainerComponent': ElementList<{
  model: LinearGenomeViewModel
}>
```

Render a custom overlay inside the LinearGenomeView TracksContainer, e.g.
highlights as a full-height div over the tracks area. Contribute the node with
[`addExtensionElement`](#accumulating-points), which fixes the React `key` for
you, or `contributeToExtensionPoint` if you need to build it yourself.

### LinearGenomeView-OverviewScalebarComponent

type: synchronous

Registered contract, an accumulator of nodes rendered inside the overview
scalebar:

<!-- include: plugins/linear-genome-view/src/LinearGenomeView/index.ts#overviewScalebar -->

```typescript
/** #extensionPoint LinearGenomeView-OverviewScalebarComponent | sync | Add a component to the overview scalebar */
'LinearGenomeView-OverviewScalebarComponent': ElementList<{
  model: LinearGenomeViewModel
  overview: ViewLayout
}>
```

Render custom overlays inside the overview scalebar, e.g. bookmark highlights.
Contribute the node with `addExtensionElement`, or `contributeToExtensionPoint`
if you need to build it yourself.

### LinearGenomeView-searchResultSelected

type: async

Registered contract:

<!-- include: plugins/linear-genome-view/src/searchUtils.ts#searchResultSelected -->

```typescript
'LinearGenomeView-searchResultSelected': {
  // nothing to accumulate: the point exists to react to the selection
  args: undefined
  result: undefined | Promise<void>
  props: {
    session: AssemblyHost & NotificationSink & TrackCatalog
    /** the search result that was selected */
    result: BaseResult
    model: LinearGenomeViewModel
    assemblyName: string
  }
}
```

Called when a search result is selected in the LinearGenomeView search box,
after navigation (if the result has a location). Useful for taking further
action, e.g. selecting a corresponding feature. It's a
[notification point](#notification-points): the payload lives in `props` (passed
unchanged to every callback) rather than `args`, so callbacks can't alter what
later callbacks see, and every plugin registered on it runs. Register with
`listenToExtensionPoint`; the canvas plugin's registration, which highlights the
feature the result names, is the worked example in that section.

### DotplotView-ImportFormSyntenyOptions

type: synchronous

Registered contract:

<!-- include: plugins/dotplot-view/src/DotplotView/components/ImportForm/TrackSelector.tsx#registry -->

```typescript
'DotplotView-ImportFormSyntenyOptions': {
  args: DotplotImportFormSyntenyOption[]
  result: DotplotImportFormSyntenyOption[]
  props: {
    model: DotplotViewModel
    /** name of the y-axis assembly */
    assembly1: string
    /** name of the x-axis assembly */
    assembly2: string
  }
}
```

Add custom radio options to the DotplotView import form; selecting one renders
the plugin's React component. In-tree formats are listed in
`defaultSyntenyFileFormats` rather than contributed here, so this point and its
`LinearSyntenyView` twin exist for formats that live outside this repo. Each
option:

<!-- include: plugins/dotplot-view/src/DotplotView/components/ImportForm/TrackSelector.tsx#option -->

```typescript
export interface DotplotImportFormSyntenyOption {
  /** unique identifier for the radio option */
  value: string
  /** display text for the radio option */
  label: string
  ReactComponent: React.FC<{
    model: DotplotViewModel
    assembly1: string
    assembly2: string
  }>
}
```

Example: adding a custom synteny option that fetches data from a server

<!-- include: plugins/dotplot-view/src/DotplotView/components/ImportForm/syntenyOptions.test.tsx#register -->

```typescript
function addSyntenyOption(pluginManager: PluginManager) {
  pluginManager.contributeToExtensionPoint(
    'DotplotView-ImportFormSyntenyOptions',
    ({ assembly1, assembly2 }) => ({
      value: `my-server-${assembly1}-${assembly2}`,
      label: 'Load from my server',
      ReactComponent: MySyntenyServerComponent,
    }),
  )
}
```

### DotplotView-SyntenyFileFormats

type: synchronous

- `args` - `SyntenyFileFormatOption[]` - array of file format options for the
  "New track" panel in the dotplot import form

Add support for new synteny file formats in the DotplotView import form. The
built-in formats (`.paf`, `.delta`, `.out`, `.chain`, `.anchors`,
`.anchors.simple`, `.pif.gz`) are the point's initial value and are always kept;
a contribution is added after them. Each option:

<!-- include: packages/synteny-core/src/SelectorTypes.ts#fileFormatOption -->

```typescript
export interface SyntenyFileFormatOption {
  /** label and radio button value, e.g. '.maf' */
  extension: string
  /**
   * the tool that emits this format, e.g. 'minimap2'. Shown under the radio, so
   * a user who knows what produced their file can find it without matching
   * extensions. Optional: a format nobody would name by tool just omits it.
   */
  producer?: string
  Component: React.FC<{
    assembly1: string
    assembly2: string
    onAdapterChange: (r: { adapter: object; name: string } | undefined) => void
  }>
}
```

`onAdapterChange` should be called with the built adapter config whenever the
user's file selection is complete, or `undefined` when the selection is cleared.

Four of the built-in formats (`.paf`, `.delta`, `.out`, `.chain`) come from one
helper in `@jbrowse/synteny-core` — the three `.anchors`/`.pif.gz` variants need
a second file or a different selector and have their own — and it is the
smallest complete example of the shape:

<!-- include: packages/synteny-core/src/defaultSyntenyFileFormats.tsx#simpleFormat -->

```typescript
function makeSimpleFormat(
  extension: string,
  adapterType: string,
  locationKey: string,
  producer: string,
): SyntenyFileFormatOption {
  const Component = observer(function SyntenyFormat({
    assembly1,
    assembly2,
    onAdapterChange,
  }: FormatProps) {
    const [fileLocation, setFileLocation] = useState<FileLocation>()
    const [swap, setSwap] = useState(false)

    const buildAdapter = (loc: FileLocation, sw: boolean) => ({
      type: adapterType,
      [locationKey]: loc,
      queryAssembly: sw ? assembly2 : assembly1,
      targetAssembly: sw ? assembly1 : assembly2,
    })

    return (
      <StandardFormatSelector
        radioOption={extension}
        fileLocation={fileLocation}
        assembly1={assembly1}
        assembly2={assembly2}
        swap={swap}
        setFileLocation={loc => {
          setFileLocation(loc)
          onAdapterChange({
            name: resolvedName(loc),
            adapter: buildAdapter(loc, swap),
          })
        }}
        setSwap={sw => {
          setSwap(sw)
          if (fileLocation) {
            onAdapterChange({
              name: resolvedName(fileLocation),
              adapter: buildAdapter(fileLocation, sw),
            })
          }
        }}
      />
    )
  })
  return { extension, producer, Component }
}
```

Two things to copy from it:

- **The component owns the file-location state** and calls `onAdapterChange` on
  _every_ change, including the swap toggle after a file is already chosen —
  reporting only on the file pick leaves the form holding an adapter with the
  assemblies the wrong way round.
- **`StandardFormatSelector` is exported from `@jbrowse/synteny-core`**, so a
  plugin format gets the same file/swap UI as the built-ins.

Register it with
`pluginManager.contributeToExtensionPoint('DotplotView-SyntenyFileFormats', () => myFormat)`.

### LinearSyntenyView-SyntenyFileFormats

type: synchronous

Same as `DotplotView-SyntenyFileFormats` but for the LinearSyntenyView import
form: same `SyntenyFileFormatOption[]` in and out, and neither point declares
props. One component (`ImportSyntenyOpenCustomTrack`) fires whichever of the two
it was handed, which is why the shapes are declared together in
`@jbrowse/synteny-core`.

### LinearSyntenyView-ImportFormSyntenyOptions

type: synchronous

Registered contract:

<!-- include: plugins/linear-comparative-view/src/LinearSyntenyView/components/ImportForm/ImportSyntenyTrackSelectorArea.tsx#registry -->

```typescript
'LinearSyntenyView-ImportFormSyntenyOptions': {
  args: LinearSyntenyImportFormSyntenyOption[]
  result: LinearSyntenyImportFormSyntenyOption[]
  props: {
    model: LinearSyntenyViewModel
    /** name of the top assembly */
    assembly1: string
    /** name of the bottom assembly */
    assembly2: string
    /** which synteny row of the import form the option is rendering for */
    selectedRow: number
  }
}
```

Add custom radio options to the LinearSyntenyView import form. Same pattern as
`DotplotView-ImportFormSyntenyOptions`, with the extra `selectedRow` telling you
which synteny row of the form you are rendering for. Each option:

<!-- include: plugins/linear-comparative-view/src/LinearSyntenyView/components/ImportForm/ImportSyntenyTrackSelectorArea.tsx#option -->

```typescript
export interface LinearSyntenyImportFormSyntenyOption {
  /** unique identifier for the radio option */
  value: string
  /** display text for the radio option */
  label: string
  ReactComponent: React.FC<{
    model: LinearSyntenyViewModel
    assembly1: string
    assembly2: string
    selectedRow: number
  }>
}
```

Example: the same server option, told which row pair it is rendering for

<!-- include: plugins/linear-comparative-view/src/LinearSyntenyView/components/ImportForm/syntenyOptions.test.tsx#register -->

```typescript
function addSyntenyOption(pluginManager: PluginManager) {
  pluginManager.contributeToExtensionPoint(
    'LinearSyntenyView-ImportFormSyntenyOptions',
    ({ assembly1, assembly2, selectedRow }) => ({
      value: `my-server-${assembly1}-${assembly2}`,
      label: `Load rows ${selectedRow + 1} and ${selectedRow + 2} from my server`,
      ReactComponent: MySyntenyServerComponent,
    }),
  )
}
```

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

<!-- include: products/jbrowse-desktop/src/components/StartScreen/startScreenExtensionPoints.test.ts#register -->

```typescript
function addStartScreenMenuItem(
  pluginManager: PluginManager,
  configPath: string,
) {
  pluginManager.contributeToExtensionPoint(
    'Desktop-StartScreenMenuItems',
    ({ setPluginManager, loadPluginManager }) => ({
      label: 'Open my thing...',
      onClick: () => {
        loadPluginManager(configPath)
          .then(setPluginManager)
          .catch(console.error)
      },
    }),
  )
}
```

A callback that throws here costs the plugin its menu items only: the fold
reports it and carries on, so the other plugins' items still appear and the
dialog that can uninstall the misbehaving one stays reachable.

### Desktop-StartScreenLaunchPanel

type: synchronous

- `args` - `ComponentType<StartScreenPanelProps>` - the "Launch new session"
  panel component
- `props` - `{ setPluginManager, loadPluginManager }`

Desktop only, and the same component slot as `Core-replaceWidget` — fill it with
[`wrapComponent`](#wrapcomponent-the-one-way-to-fill-a-slot), rendering the
`DefaultComponent` you were handed to keep the built-in panel below your own
chrome. If your component throws while rendering, the start screen falls back to
the built-in panel and shows an error above it.

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
