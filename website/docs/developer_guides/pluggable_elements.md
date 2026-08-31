---
title: Pluggable elements
description: Overview of all element types a plugin can register
guide_category: Getting started
---

**TL;DR:** the ten element types a plugin can register — adapters, text search
adapters, displays, tracks, connections, views, widgets, RPC methods, internet
accounts and add-track workflows — plus extension points, and which guide covers
each. Drawing is implemented by the display types.

A plugin's `install` method adds these elements to the host application, while
`configure` typically sets up
[mobx autoruns](https://mobx.js.org/refguide/autorun.html) that react to
application state ([](/docs/developer_guides/simple_plugin) covers the class
itself). A plugin is loaded at runtime as an ESM module, or a UMD bundle for
legacy compatibility, and **only one version of a given plugin can be loaded on
a page, even if multiple products use it.**

## Pluggable elements

Pluggable elements are pieces of functionality a plugin can add to JBrowse, in
the order the plugin manager creates them:

<!-- ELEMENT_PHASES START -->

<!-- prettier-ignore -->
| Phase | Element type | Registered with |
| --- | --- | --- |
| 1 | Adapter types | <code>pluginManager.addAdapterType()</code> |
| 2 | Text search adapter types | <code>pluginManager.addTextSearchAdapterType()</code> |
| 3 | Display types | <code>pluginManager.addDisplayType()</code> |
| 4 | Track types | <code>pluginManager.addTrackType()</code> |
| 5 | Connection types | <code>pluginManager.addConnectionType()</code> |
| 6 | View types | <code>pluginManager.addViewType()</code> |
| 7 | Widget types | <code>pluginManager.addWidgetType()</code> |
| 8 | RPC method types | <code>pluginManager.addRpcMethod()</code> |
| 9 | Internet account types | <code>pluginManager.addInternetAccountType()</code> |
| 10 | Add track workflow types | <code>pluginManager.addAddTrackWorkflowType()</code> |

<!-- ELEMENT_PHASES END -->

The order is a real dependency: your `install` runs before any of them are
built, and the plugin manager then creates each group in turn, so a track type
registered in the fourth phase can look up a display type registered in the
third by name. Look up only what an earlier phase has already built.

Extension points are the eleventh way a plugin extends the app: named callbacks
the host fires. See [](/docs/developer_guides/extension_points).

Elements are composable: adapters can wrap other adapters (`MultiWiggleAdapter`
takes a `subadapters` array), and views can contain sub-views (`SvInspectorView`
holds a `SpreadsheetView` and a `CircularView`).

The three you will meet first relate like this:

- A view is a container that typically _has tracks_
- A track controls _what_ data (adapter) and _how_ it's shown (display)
- A display owns the drawing of a track's data; a track may have multiple
  displays for different view types

## View types

View types allow entirely different visualizations alongside the linear genome
view. The seven in-tree types:

- `LinearGenomeView` - the classic linear view of a genome
- `CircularView` - a Circos-like circular whole genome view
- `DotplotView` - a comparative 2-D genome view
- `LinearSyntenyView` - two or more linear views stacked, with synteny drawn
  between them
- `BreakpointSplitView` - two linear views showing the two sides of a structural
  variant
- `SpreadsheetView` - a tabular view of a feature file
- `SvInspectorView` - super-view containing `CircularView` and `SpreadsheetView`
  sub-views

Each has a generated state-model page under [](/docs/models), and
[](/docs/developer_guides/creating_view) covers writing your own.

## Adapters

Adapters parse a data format. To write your own, see
[creating adapters](/docs/developer_guides/creating_adapter/). The
`@jbrowse/plugin-alignments` plugin creates:

- `BamAdapter` - wraps the `@gmod/bam` NPM module for the browser
- `CramAdapter` - wraps the `@gmod/cram` NPM module; the sequence adapter is
  injected at runtime from the enclosing assembly

[](/docs/config_guides/file_types) maps every supported format to the adapter
that reads it.

## Track types

A track combines an adapter with one or more displays, and can also:

- Add extra menu items to the track menu. The track's own menu is assembled from
  its displays' `trackMenuItems()` plus a "Display types" submenu, so most items
  come from the display rather than the track
- Add its own file formats to "Save track data"

Example tracks:

- `AlignmentsTrack` (from `@jbrowse/plugin-alignments`) - reads and their
  coverage, drawn by a single `LinearAlignmentsDisplay`
- `VariantTrack` (from `@jbrowse/plugin-variants`) - displays variant features
- `FeatureTrack` (from `@jbrowse/plugin-linear-genome-view`) - displays generic
  features including gene glyphs

## Displays

A _display_ is a method for showing a track in a particular view, letting one
track entry work across view types; a track may own several, one per view type
it supports. A display also decides:

- What the track draws, and on which rendering path (see below)
- Which widget opens on a feature click, via a `featureWidgetType` getter
- Which regions to fetch — the view's `staticBlocks` (stable while scrolling) or
  `dynamicBlocks` (recomputed as the view moves)

See [](/docs/developer_guides/creating_display) for how tracks and displays
relate and when to add a new one, and
[](/docs/config_guides/tracks#configuring-displays) for the generated table of
which displays attach to which track type.

## Rendering

Drawing is implemented by the **display types**:

- The worker fetches feature data via RPC and returns compact typed arrays
  (absolute genomic uint32 coordinates). Its job ends there; drawing begins on
  the main thread.
- The main thread draws that data with WebGPU, falling back to WebGL2, then
  Canvas2D. This covers alignments, features, variants, wiggle, synteny, MAF,
  Hi-C, GWAS and dotplot. Every one of them supplies a Canvas2D draw function,
  which SVG export runs too, so on-screen and exported pixels stay identical;
  the shader path is an accelerator layered over it.
- The arc displays take a third route: their components emit JSX `<path>`
  elements, on screen and in SVG export alike.

`DisplayChrome` is the wrapper every canvas-backed display renders, and it owns
the loading scrim, the error banner, the "region too large" message and the
render-error retry. It picks between them from a single getter,
[`displayPhase`](/docs/models/multiregiondisplaymixin#getter-displayphase),
which each display answers with one of `loading` / `error` / `tooLarge` /
`renderError` / `ready`. So a new display gets every terminal state by composing
the foundation mixins and answering that getter, and the arc displays get the
same chrome through `DisplayStatusChrome`, the backend-free half.

See
[display foundations](/docs/developer_guides/creating_display#display-foundations)
for the mixins this is built from, and
[](/docs/developer_guides/creating_gpu_display) to build one.

## Widgets

Widgets are custom info panels shown in side panels, modals, or elsewhere. Most
of the app's own chrome is built from them — the plugin store, the session
manager and the track selector are all widgets. The ones a plugin author meets
first:

- `BaseFeatureWidget` - the feature detail panel
- `ConfigurationEditorWidget` - the per-track settings editor
- `AddTrackWidget` and `AddConnectionWidget` - the two add flows

Plugins can extend widgets. For example, `@jbrowse/plugin-alignments` extends
`BaseFeatureWidget`:

- `AlignmentsFeatureWidget` - customizes the basic feature detail widget for
  alignments features

A display names the one it opens with a `featureWidgetType` getter; to replace a
widget you do _not_ own, use
[`Core-replaceWidget`](/docs/developer_guides/extension_points#core-replacewidget).

## RPC methods

Plugins can register RPC methods to offload custom behavior to a web worker or
server-side process. The wiggle plugin registers, for example:

- `MultiWiggleGetScoreMatrix`
- `MultiWiggleClusterScoreMatrix`

These run in the web worker when available.

## Add track workflows

Add track workflows let a plugin supply a custom React component for loading
tracks into a session. See the
[add-track workflow guide](/docs/developer_guides/creating_addtrack_workflow).

## Connection types

A connection fetches a set of track configs from somewhere else and adds them to
the session — `UCSCTrackHubConnection`, `JB2TrackHubConnection` and
`JBrowse1Connection` are the in-tree ones. See
[](/docs/developer_guides/creating_connection).

## Text search adapter types

A text search adapter answers the search box's name lookups. See
[](/docs/developer_guides/creating_text_search_adapter).

## Internet account types

An internet account supplies credentials for a data source that needs them, so a
track can read from Dropbox, Google Drive, or a host behind HTTP basic auth or a
bearer token. `@jbrowse/plugin-authentication` registers all five; their config
slots are documented under [](/docs/config/baseinternetaccount).

## Extension points

Extension points are named callback chains: a producer fires one, and any plugin
can register a callback against the same name to transform what it carries, add
to a list, or just react.

See the [full extension point API](/docs/developer_guides/extension_points) or
the [menus guide](/docs/developer_guides/menus) for an example of adding context
menu items.

## See also

- [](/docs/developer_guides/simple_plugin)
- [](/docs/developer_guides/creating_display)
- [](/docs/developer_guides/creating_view)
- [](/docs/developer_guides/creating_widget)
- [](/docs/developer_guides/configuration_schema)
