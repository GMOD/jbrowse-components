---
id: developer_pluggable_elements
title: Pluggable elements
---

Pluggable elements are basic "extension points" that you can customize in
JBrowse 2 plugins

The pluggable types that we have in JBrowse 2 are

- Data adapters
- Track types
- Renderer types
- Drawer widgets
- RPC calls
- View types

In additional to creating plugins that create new data adapters, track types,
etc. note that you can also wrap the behavior of another track so these
elements are composable

For example we can have adapters that perform calculations on the results of
another adapter, views that contains other subviews, and tracks that contain
other tracks, leading to a lot of interesting behavior. Details and examples
below

### Data adapters

Data adapters basically are parsers for a given data format. We will review
what data adapters the alignments plugin has (to write your own data adapter,
see [creating data adapters](developer_creating_data_adapters))

Example data adapter: in @gmod/jbrowse-plugin-alignments plugin, we have
multiple data adapters

- BamAdapter - a data adapter for the BAM data format. This adapter uses the
  `@gmod/cram` NPM module, and supplies a getFeatures function and a getRefNames
  function, which satisfies the needs of our BaseFeatureDataAdapter type
- CramAdapter - a data adapter for the CRAM data format. This adapter uses the
  @gmod/cram NPM module, and supplies a getFeatures function and a getRefNames
  function which satisfies our BaseFeatureDataAdapter type. Note that
  CramAdapter also takes a sequenceAdapter as a subadapter configuration, and
  uses getSubAdapter to instantiate it
- SNPCoverageAdapter - this adapter is a wrapper around a BamAdapter or
  CramAdapter, and it uses getSubAdapter to instantiate the subAdapter config.
  By wrapping the BAM or CRAM adapter, it can run calculations of the features
  and output them to multiple contexts, including (a) contexts which requests
  statistics (b) and contexts that draw features

### Renderers

Renderers are a new concept in JBrowse 2, and are related to the concept of
server side rendering (SSR), but can be used not just on the server but also in
contexts like the web worker (e.g. the webworker can draw the features to an
OffscreenCanvas). For more info see [creating
renderers](developer_creating_renderers)

Example renderers: in @gmod/jbrowse-plugin-alignments, we have multiple
renderer types

- PileupRenderer - a renderer type that renders Pileup type display of
  alignments fetched from the BamAdapter/CramAdapter
- SNPCoverageRenderer - a renderer that draws the coverage. Note that this
  renderer derives from the wiggle renderer, but does the additional step of
  drawing the mismatches over the coverage track

### Track types

Track types are a high level type that controls how features are drawn. In most
cases, a track combines a renderer and an adapter, and can do additional things like

- Control what drawer widget pops up on feature click
- Add extra menu items to the track menu
- Create subtracks (See AlignmentsTrack)
- Choose "static-blocks" rendering styles, which keeps contents stable while
  the user scrolls, or "dynamic-blocks" that update on each scroll

Example tracks: in @gmod/jbrowse-plugin-alignments, we have multiple
track types

- SNPCoverageTrack - this track type actually derives from the WiggleTrack type
- PileupTrack - a track type that draws alignment pileup results
- AlignmentsTrack - this is a "combination track", that contains a
  SNPCoverageTrack and PileupTrack as "subtracks"

### Drawer widgets

Drawer widgets are custom info panels that show up in our sidebar, and are an
alternative to modal dialogs

Drawer widgets can do multiple types of things including

- Configuration drawer widget
- Feature detail drawer widget
- Add track drawer widget
- Add connection drawer widget
- etc.

These drawer widgets can be extended via plugins, so for example, the
@gmod/jbrowse-plugin-alignments extends the BaseFeatureDetailDrawerWidget to
have custom display of the alignments

- AlignmentsFeatureDetailDrawerWidget - this provides a custom drawer widget
  for viewing the feature details of alignments features that customizes the
  basic feature detail widget

### View types

Creating view types is one of the most powerful features of JBrowse 2, because
it allows us to put entirely different visualizations in the same context as
the standard linear-genome-view.

We have demonstrated a couple new view types in JBrowse 2 already including

- LinearGenomeView - the classic linear view of a genome
- CircularView - a circular whole genome overview that can show
  interchromosomal translocation arcs
- DotplotView - a comparative 2-D genome view
- SV inspector - packages/sv-inspector, which is a "combo view" containing
  CircularView and SpreadsheetView child views
- And more!

We think the boundaries for this are just your imagination, and there can also
be interplay between view types e.g. popup dotplot from a linear view, etc.

### RPC methods

Plugins can register their own RPC methods, which can allow them to offload
custom behaviors to a web-worker or server side process. The Wiggle track for
example registers WiggleGetGlobalStats and WiggleGetMultiRegionStats
