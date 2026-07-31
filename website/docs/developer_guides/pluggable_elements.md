---
title: Pluggable elements
description: Overview of all element types a plugin can register
guide_category: Getting started
---

A plugin is an independently distributed package that plugs into a JBrowse
application. It's a class extending `@jbrowse/core/Plugin` with `install` and
`configure` methods the application calls.

The class is distributed as an ESM module (or UMD bundle for legacy
compatibility) loaded at runtime. **Only one version of a given plugin can be
loaded on a page, even if multiple products use it.**

`configure` typically sets up
[mobx autoruns](https://mobx.js.org/refguide/autorun.html) that react to
application state. `install` adds "pluggable elements" (new views, tracks,
displays, and so on) to the host application.

**TL;DR:** A tour of every pluggable element type a plugin can register:
adapters, tracks, views, displays, widgets, RPC methods, add-track workflows,
and extension points.

Many plugins referenced below live in the
[JBrowse Github repo](https://github.com/gmod/jbrowse-components) as up-to-date
examples.

## Pluggable elements

Pluggable elements are pieces of functionality a plugin can add to JBrowse:

- Adapter types
- Track types
- View types
- Display types
- Widgets
- RPC calls
- Extension points
- Internet account types
- Connection types
- Text search adapter types
- Add track workflow

Elements are composable. Adapters can wrap other adapters, views can contain
sub-views, and tracks can contain other tracks.

## View types

View types allow entirely different visualizations alongside the linear genome
view. Examples:

- `LinearGenomeView` - the classic linear view of a genome
- `CircularView` - a Circos-like circular whole genome view
- `DotplotView` - a comparative 2-D genome view
- `SvInspectorView` - super-view containing `CircularView` and `SpreadsheetView`
  sub-views

## Adapters

Adapters parse a data format. To write your own, see
[creating adapters](/docs/developer_guides/creating_adapter/). The
`@jbrowse/plugin-alignments` plugin creates:

- `BamAdapter` - wraps the `@gmod/bam` NPM module for the browser
- `CramAdapter` - wraps the `@gmod/cram` NPM module; the sequence adapter is
  injected at runtime from the enclosing assembly

## Track types

A track combines an adapter with one or more displays, and can also:

- Control what widget pops up on feature click
- Add extra menu items to the track menu
- Create sub-tracks (see `AlignmentsTrack`, a composition of the pileup and
  coverage displays)
- Choose "static-blocks" rendering (contents stay stable while scrolling) or
  "dynamic-blocks" (update on each scroll)

Example tracks:

- `AlignmentsTrack` (from `@jbrowse/plugin-alignments`) - shows both a pileup of
  reads and the coverage as a quantitative track
- `VariantTrack` (from `@jbrowse/plugin-variants`) - displays variant features
- `FeatureTrack` (from `@jbrowse/plugin-linear-genome-view`) - displays generic
  features including gene glyphs

## Displays

A _display_ is a method for showing a track in a particular view, letting one
track entry work across view types; a track may own several, one per view type
it supports. See [](/docs/developer_guides/creating_display) for how tracks and
displays relate and when to add a new one.

## Rendering

Drawing is owned by the **display**; it is not a pluggable element of its own:

- The worker fetches feature data via RPC and returns compact typed arrays
  (absolute genomic uint32 coordinates). No drawing happens in the worker.
- The main thread draws that data with WebGPU, falling back to WebGL2, then
  Canvas2D. This covers the high-volume track types: alignments, wiggle,
  features, and variants. A few low-volume displays (the arc displays) paint
  plain main-thread SVG instead.

See
[display foundations](/docs/developer_guides/creating_display#display-foundations)
for the mixins this is built from, and
[](/docs/developer_guides/creating_gpu_display) to build one.

How views, tracks, and displays relate:

- A view is a container that typically _has tracks_
- A track controls _what_ data (adapter) and _how_ it's shown (display)
- A display owns the drawing of a track's data; a track may have multiple
  displays for different view types

## Widgets

Widgets are custom info panels shown in side panels, modals, or elsewhere. Types
include:

- Configuration widget
- Feature detail widget
- Add track widget
- Add connection widget

Plugins can extend widgets. For example, `@jbrowse/plugin-alignments` extends
`BaseFeatureWidget`:

- `AlignmentsFeatureWidget` - customizes the basic feature detail widget for
  alignments features

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

## Extension points

Extension points let a plugin register a callback that runs at an appropriate
time.

See the [full extension point API](/docs/developer_guides/extension_points) or
the [menus guide](/docs/developer_guides/menus) for an example of adding context
menu items.

## See also

- [](/docs/developer_guides/simple_plugin)
- [](/docs/developer_guides/creating_display)
- [](/docs/developer_guides/creating_view)
- [](/docs/developer_guides/creating_widget)
- [](/docs/developer_guides/configuration_schema)
