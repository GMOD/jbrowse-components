---
id: pluggable_elements
title: Pluggable elements
---

A plugin is an independently distributed package of code that plugs into a
JBrowse application. It's implemented as a class that extends
`@jbrowse/core/Plugin`, and has `install` and `configure` methods the
application calls.

This class is distributed as an ESM module (or UMD bundle for legacy
compatibility) that gets loaded by the JBrowse application at runtime. **This
means it is only possible to have one version of a particular plugin loaded on
any given webpage, even if multiple products are loaded and using it on the same
page.**

It's common for a plugin to use its `configure` method to set up
[mobx autoruns](https://mobx.js.org/refguide/autorun.html) that react to changes
in the application's state to modify its behavior.

Plugins often also have their `install` method add "pluggable elements" into the
host JBrowse application. This is how plugins can add new kinds of views,
tracks, renderers, and so forth.

:::info

Many plugins referenced below are in the
[JBrowse Github repo](https://github.com/gmod/jbrowse-components) and serve as
up-to-date examples.

:::

### Pluggable elements

Pluggable elements are pieces of functionality that plugins can add to JBrowse.
Examples of pluggable types include:

- Adapter types
- Track types
- View types
- Display types
- Renderer types
- Widgets
- RPC calls
- Extension points
- Internet account types
- Connection types
- Text search adapter types
- Add track workflow

Elements are composable — adapters can wrap other adapters, views can contain
sub-views, and tracks can contain other tracks.

### View types

View types allow entirely different visualizations alongside the standard linear
genome view. Examples include:

- `LinearGenomeView` - the classic linear view of a genome
- `CircularView` - a Circos-like circular whole genome view
- `DotplotView` - a comparative 2-D genome view
- `SvInspectorView` - super-view containing `CircularView` and `SpreadsheetView`
  sub-views
- And more

### Adapters

Adapters parse a given data format. To write your own, see
[creating adapters](/docs/developer_guides/creating_adapter/). The
`@jbrowse/plugin-alignments` plugin creates:

- `BamAdapter` - This adapter uses the `@gmod/bam` NPM module, and adapts it for
  use by the browser.
- `CramAdapter` - This adapter uses the `@gmod/cram` NPM module. Note that
  CramAdapter also takes a sequenceAdapter as a sub-adapter configuration, and
  uses getSubAdapter to instantiate it

### Track types

Track types are a high level type that controls how features are drawn. In most
cases, a track combines a renderer and an adapter, and can do additional things
like:

- Control what widget pops up on feature click
- Add extra menu items to the track menu
- Create sub-tracks (See `AlignmentsTrack`, a composition of the pileup and
  coverage display)
- Choose "static-blocks" rendering styles, which keeps contents stable while the
  user scrolls, or "dynamic-blocks" that update on each scroll

Example tracks:

- `AlignmentsTrack` (from `@jbrowse/plugin-alignments`) - shows both a pileup of
  reads and the coverage as a quantitative track
- `VariantTrack` (from `@jbrowse/plugin-variants`) - displays variant features
- `FeatureTrack` (from `@jbrowse/plugin-gff3`) - displays generic features
  including gene glyphs

### Displays

A _display_ is a method for displaying a particular track in a particular view.

For example, we have a notion of a synteny track type, and the synteny track
type has two display models:

- `DotplotDisplay`, which is used in the dotplot view
- `LinearSyntenyDisplay`, which is used in the linear synteny view

This enables a single track entry to be used in multiple view types e.g. if I
run `jbrowse add-track myfile.paf`, this automatically creates a `SyntenyTrack`
entry in the tracklist, and when this track is opened in the dotplot view, the
`DotplotDisplay` is used for rendering.

Another example of a track type with multiple display types is `VariantTrack`,
which has two display methods

- `LinearVariantDisplay` - used in linear genome view
- `ChordVariantDisplay` - used in the circular view to draw breakends and
  structural variants

### Renderers

Renderers run in a web worker and draw features (e.g. to an OffscreenCanvas).
See [creating renderers](/docs/developer_guides/creating_renderer/).

For example, the `@jbrowse/plugin-alignments` exports several renderer types:

- `PileupRenderer` - a renderer type that renders Pileup type display of
  alignments fetched from the `BamAdapter`/`CramAdapter`
- `SNPCoverageRenderer` - a renderer that draws the coverage. Note that this
  renderer derives from the wiggle renderer, but does the additional step of
  drawing the mismatches over the coverage track

:::info

How views, tracks, displays, and renderers relate:

- A **view** is a container that typically _has tracks_
- A **track** controls _what_ data (adapter) and _how_ it's displayed
  (display/renderer)
- A **display** is a specific way to render a track's data — a track may have
  multiple displays for different view types
- A **renderer** controls the actual drawing, e.g. what happens on mouse over

:::

### Widgets

Widgets are custom info panels that can show up in side panels, modals, or other
places in an app.

Widgets can do multiple types of things, including:

- Configuration widget
- Feature detail widget
- Add track widget
- Add connection widget
- etc.

These widgets can be extended via plugins, so for example, the
`@jbrowse/plugin-alignments` extends the `BaseFeatureDetailWidget` to have
custom display of the alignments.

- `AlignmentsFeatureDetailWidget` - this provides a custom widget for viewing
  the feature details of alignments features that customizes the basic feature
  detail widget

### RPC methods

Plugins can register their own RPC methods, which can allow them to offload
custom behaviors to a web-worker or server side process.

The wiggle plugin, for example, registers custom RPC method types including:

- `WiggleGetMultiRegionQuantitativeStats`
- `WiggleGetGlobalQuantitativeStats`

These methods can run in the web worker when available.

### Add track workflows

Add track workflows allow users to specify a custom react component for loading
tracks into a jbrowse session.

Checkout the [docs here](/docs/developer_guides/creating_addtrack_workflow).

### Extension points

Extension points are a pluggable element type which allows users to add a
callback that is called at an appropriate time.

Checkout the [full extension point API](/docs/developer_guides/extension_points)
or an [example for adding context menu items](/docs/developer_guides/menus) for
more detailed information.

### Next steps

- [Configuration model](/docs/developer_guides/config_model)
- [Plugin tutorial](/docs/developer_guides/simple_plugin/)
