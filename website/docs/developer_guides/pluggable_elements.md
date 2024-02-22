---
id: pluggable_elements
title: Pluggable elements
---

import Figure from '../figure'

A plugin is an independently distributed package of code that is designed to
"plug in" to a JBrowse application.

It's implemented as a class that extends `@jbrowse/core/Plugin`. It gets
instantiated by the application that it plugs into, and it has an `install`
method and a `configure` method that the application calls.

This class is distributed as a webpack bundle that exports it to a namespace on
the browser's `window` object specifically for JBrowse plugins. **This means it
is only possible to have one version of a particular plugin loaded on any given
webpage, even if multiple products are loaded and using it on the same page.**

It's common for a plugin to use its `configure` method to set up
[mobx autoruns or reactions](https://mobx.js.org/refguide/autorun.html) that
react to changes in the application's state to modify its behavior.

Plugins often also have their `install` method add "pluggable elements" into the
host JBrowse application. This is how plugins can add new kinds of views,
tracks, renderers, and so forth.

:::info

Many of the plugins referenced in the following section are found in
[the JBrowse Github repo](https://github.com/gmod/jbrowse-components).

We encourage you to reference and review the concepts presented here using the
functional and up-to-date plugin code found there.

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
- Extension points
- Add track workflow

In additional to creating plugins that create new adapters, track types, etc.
note that you can also wrap the behavior of another track so these elements are
composable.

For example, we can have adapters that perform calculations on the results of
another adapter, views that contains other subviews, and tracks that contain
other tracks, leading to a lot of interesting behavior.

Let's dive further into these details, and look at some examples.

### View types

Creating view types is one of the most powerful features of JBrowse 2, because
it allows us to put entirely different visualizations in the same context as the
standard linear-genome-view.

We have demonstrated a couple new view types in JBrowse 2 already, including:

- `LinearGenomeView` - the classic linear view of a genome
- `CircularView` - a Circos-like circular whole genome view
- `DotplotView` - a comparative 2-D genome view
- `SvInspectorView` - superview containing `CircularView` and `SpreadsheetView`
  subviews
- And more!

We think the boundaries for this are just your imagination, and there can also
be interplay between view types e.g. popup dotplot from a linear view, etc.

### Adapters

Adapters are parsers for a given data format. We will review what adapters the
alignments plugin has (to write your own adapter, see
[creating adapters](/docs/developer_guides/creating_adapter/)).

Example adapters: the `@jbrowse/plugin-alignments` plugin creates multiple
adapter types:

- `BamAdapter` - This adapter uses the `@gmod/bam` NPM module, and adapts it for
  use by the browser.
- `CramAdapter` - This adapter uses the `@gmod/cram` NPM module. Note that
  CramAdapter also takes a sequenceAdapter as a subadapter configuration, and
  uses getSubAdapter to instantiate it

### Track types

Track types are a high level type that controls how features are drawn. In most
cases, a track combines a renderer and an adapter, and can do additional things
like:

- Control what widget pops up on feature click
- Add extra menu items to the track menu
- Create subtracks (See `AlignmentsTrack`)
- Choose "static-blocks" rendering styles, which keeps contents stable while the
  user scrolls, or "dynamic-blocks" that update on each scroll

Example tracks: the `@jbrowse/plugin-alignments` exports multiple track types:

- `VariantTrack` - displays variant features
- `FeatureTrack` - displays generic features including gene glyphs
- `AlignmentsTrack` - shows both a pileup or reads and the coverage as a
  quantiative track

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

Renderers are a new concept in JBrowse 2, and are related to the concept of
server side rendering (SSR), but can be used not just on the server but also in
contexts like the web worker (e.g. the webworker can draw the features to an
OffscreenCanvas). For more info see
[creating renderers](/docs/developer_guides/creating_renderer/).

For example, the `@jbrowse/plugin-alignments` exports several renderer types:

- `PileupRenderer` - a renderer type that renders Pileup type display of
  alignments fetched from the `BamAdapter`/`CramAdapter`
- `SNPCoverageRenderer` - a renderer that draws the coverage. Note that this
  renderer derives from the wiggle renderer, but does the additional step of
  drawing the mismatches over the coverage track

:::info

Views, tracks, displays, renderers? If you're confused about what kind of
pluggable element you might need to accomplish your development goals, a way to
remember the relationship between these four pluggable elements is as follows:

1. A view is a container for anything, views typically _have tracks_ (the linear
   genome view especially)
2. A track controls the _what_ (kind of data, data adapters used) and _how_
   (displays, renderers) of the data you'd like to display, typically within a
   view
3. A display is a way you might want to display the data on a track, you might
   have multiple displays for a given view, for example, displays can determine
   if a feature is drawn with rectangles or with triangles; displays _may_ have
   renderers
4. A renderer controls how the display is presented, for example what might
   happen when you mouse over a feature

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

The wiggle plugin, for example, registers two custom RPC method types:

- `WiggleGetMultiRegionQuantitativeStats`

These methods can run in the webworker when available.

### Add track workflows

Add track workflows allow users to specify a custom react component for loading
tracks into a jbrowse session.

Checkout the [docs here](/docs/developer_guides/creating_addtrack_workflow).

### Extension points

Extension points are a pluggable element type which allows users to add a
callback that is called at an appropriate time.

Checkout the [full extension point API](/docs/developer_guides/extension_points)
or an
[example for adding context menu items](/docs/developer_guides/modifying_menus)
for more detailed information.

### Next steps

Now that you have an overview of the different pluggable element types that are
available to you, review your
[understanding of the configuration model](../config_model).

Also checkout the [guided tutorial](/docs/tutorials/simple_plugin/) for writing
a plugin, which will take you through everything from installation, creating a
new pluggable element, and general development tips for working with JBrowse 2.
