---
id: developer_guide
title: Core concepts and intro to pluggable elements
toplevel: true
---

import Figure from './figure'

This guide will introduce the JBrowse 2 ecosystem from the developer's
point of view. We'll examine the core concepts of how code is packaged and
structured, and then go over how to create new plugins and pluggable elements.

## Introduction and overview

Let's get a high-level view of the JBrowse 2 ecosystem.

## Products and plugins

The JBrowse 2 ecosystem has two main types of top-level artifacts that are
published on their own: products and plugins.

<Figure src="/img/products_and_plugins.png" caption="Architecture diagram of JBrowse 2, showing how plugins encapsulate views (e.g. LinearGenomeView, DotplotView etc.), tracks (AlignmentsTrack, VariantTrack, etc.), adapters (BamAdapter, VcfTabixAdapter, etc.) and other logic like mobx state tree autoruns that add logic to other parts of the app (e.g. adding context menus)"/>

A "product" is an application of some kind that is published on its own (a web
app, an electron app, a CLI app, etc). `jbrowse-web`, `jbrowse-desktop`, and
`jbrowse-cli` are products.

A "plugin" is a package of functionality that is designed to "plug in" to a
product **at runtime** to add functionality. These can be written and published
by anyone, not just the JBrowse core team. Not all of the products use plugins,
but most of them do.

Also, most of the products are pretty standard in the way they are constructed.
For example, `jbrowse-web` is a React web application that is made with [Create
React App (CRA)](https://create-react-app.dev/), and jbrowse-cli is a
command-line tool implemented with [OCLIF](https://oclif.io/).

<Figure src="/img/product_architecture.png" caption="This figure summarizes the general architecture of our state model and React component tree"/>

## Example plugins

You can follow this guide for developing plugins, but you might also want to
refer to working versions of plugins on the web now.

This repo contains a template for creating new plugins
https://github.com/GMOD/jbrowse-plugin-template.

Here are some examples of working plugins:

- [jbrowse-plugin-ucsc-api](https://github.com/cmdcolin/jbrowse-plugin-ucsc-api)
  probably the simplest plugin example, it demonstrates accessing data from
  UCSC REST API
- [jbrowse-plugin-gwas](https://github.com/cmdcolin/jbrowse-plugin-gwas) a
  custom plugin to display manhattan plot GWAS data
- [jbrowse-plugin-biothings-api](https://github.com/cmdcolin/jbrowse-plugin-biothings-api)
  demonstrates accessing data from mygene.info, part of the "biothings API"
  family
- [jbrowse-plugin-msaview](https://github.com/GMOD/jbrowse-plugin-msaview) -
  demonstrates creating a custom view type that doesn't use any conventional
  tracks
- [jbrowse-plugin-gdc](https://github.com/GMOD/jbrowse-plugin-gdc) demonstrates
  accessing GDC cancer data GraphQL API, plus a custom drawer and track type
  for coloring variants by impact score
- [jbrowse-plugin-systeminformation](https://github.com/garrettjstevens/jbrowse-plugin-systeminformation)
  demonstrates using desktop specific functionality, accessing system node
  libraries. This desktop specific functionality should use the CJS bundle type
  (electron doesn't support ESM yet)

You can use these to see how plugins are generally structured, and can use the
pluggable elements in them as templates for your own pluggable elements.

Now, let's explore what plugins can do and how they are structured.

## What's in a plugin

A plugin is an independently distributed package of code that is designed to
"plug in" to a JBrowse application.

It's implemented as a class that extends `@jbrowse/core/Plugin`. It gets
instantiated by the application that it plugs into, and it has an `install`
method and a `configure` method that the application calls.

This class is distributed as a webpack bundle that exports it to a namespace on the browser's
`window` object specifically for JBrowse plugins. **This means it is only possible
to have one version of a particular plugin loaded on any given webpage, even if multiple
products are loaded and using it on the same page.**

It's common for a plugin to use its `configure` method to set up [mobx
autoruns or reactions](https://mobx.js.org/refguide/autorun.html) that react to
changes in the application's state to modify its behavior.

Plugins often also have their `install` method add "pluggable elements" into
the host JBrowse application. This is how plugins can add new kinds of views,
tracks, renderers, and so forth.

:::info Note
Many of the plugins referenced in the following section are found in [the JBrowse Github repo](https://github.com/gmod/jbrowse-components).

We encourage you to reference and review the concepts presented here using the functinal
and up-to-date plugin code found there.
:::

## Pluggable elements

Pluggable elements are pieces of functionality that plugins can add to JBrowse. Examples of pluggable types include:

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

In additional to creating plugins that create new adapters, track types,
etc. note that you can also wrap the behavior of another track so these
elements are composable.

For example, we can have adapters that perform calculations on the results of
another adapter, views that contains other subviews, and tracks that contain
other tracks, leading to a lot of interesting behavior.

Let's dive further into these details, and look at some examples.

### View types

Creating view types is one of the most powerful features of JBrowse 2, because
it allows us to put entirely different visualizations in the same context as
the standard linear-genome-view.

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

Adapters are parsers for a given data format. We will review
what adapters the alignments plugin has (to write your own adapter,
see [creating adapters](../devguide_pluggable_elements/#creating-adapters)).

Example adapters: the `@jbrowse/plugin-alignments` plugin creates
multiple adapter types:

- `BamAdapter` - This adapter uses the `@gmod/bam` NPM module, and adapts it
  for use by the browser.
- `CramAdapter` - This adapter uses the `@gmod/cram` NPM module. Note that
  CramAdapter also takes a sequenceAdapter as a subadapter configuration, and
  uses getSubAdapter to instantiate it
- `SNPCoverageAdapter` - this adapter takes a `BamAdapter` or `CramAdapter` as a
  subadapter, and calculates feature coverage from it

### Track types

Track types are a high level type that controls how features are drawn. In most
cases, a track combines a renderer and an adapter, and can do additional things like:

- Control what widget pops up on feature click
- Add extra menu items to the track menu
- Create subtracks (See `AlignmentsTrack`)
- Choose "static-blocks" rendering styles, which keeps contents stable while
  the user scrolls, or "dynamic-blocks" that update on each scroll

Example tracks: the `@jbrowse/plugin-alignments` exports multiple track
types:

- `SNPCoverageTrack` - this track type actually derives from the WiggleTrack type
- `PileupTrack` - a track type that draws alignment pileup results
- `AlignmentsTrack` - combines `SNPCoverageTrack` and `PileupTrack` as "subtracks"

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
- `ChordVariantDisplay` - used in the circular view to draw breakends and structural variants

### Renderers

Renderers are a new concept in JBrowse 2, and are related to the concept of
server side rendering (SSR), but can be used not just on the server but also in
contexts like the web worker (e.g. the webworker can draw the features to an
OffscreenCanvas). For more info see [creating
renderers](../devguide_pluggable_elements/#creating-renderers).

For example, the `@jbrowse/plugin-alignments` exports several
renderer types:

- `PileupRenderer` - a renderer type that renders Pileup type display of
  alignments fetched from the `BamAdapter`/`CramAdapter`
- `SNPCoverageRenderer` - a renderer that draws the coverage. Note that this
  renderer derives from the wiggle renderer, but does the additional step of
  drawing the mismatches over the coverage track

:::info Views, tracks, displays, renderers?
If you're confused about what kind of pluggable element you might need to accomplish
your development goals, a way to remember the relationship between these four
pluggable elements is as follows:

1. A view is a container for anything, views typically _have tracks_ (the linear genome view especially)
2. A track controls the _what_ (kind of data, data adapters used) and _how_ (displays, renderers) of the data you'd like to display, typically within a view
3. A display is a way you might want to display the data on a track, you might have multiple displays for a given view, for example, displays can determine if a feature is drawn with rectangles or with triangles; displays _may_ have renderers
4. A renderer controls how the display is presented, for example what might happen when you mouse over a feature

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
`@jbrowse/plugin-alignments` extends the `BaseFeatureDetailWidget` to
have custom display of the alignments.

- `AlignmentsFeatureDetailWidget` - this provides a custom widget
  for viewing the feature details of alignments features that customizes the
  basic feature detail widget

### RPC methods

Plugins can register their own RPC methods, which can allow them to offload
custom behaviors to a web-worker or server side process.

The wiggle plugin, for example, registers two custom RPC method types:

- `WiggleGetGlobalStats`
- `WiggleGetMultiRegionStats`

These methods can run in the webworker when available.

### Add track workflows

Plugins can register their own React component to display in the "Add track"
widget for adding tracks that require custom logic. The Multi-wiggle track is
an example of this, it produces a textbox where you can paste a list of files.

A simple addition to the add track workflow:

```js
// plugins/wiggle/MultiWiggleAddTrackWidget/index.jsx

import PluginManager from '@jbrowse/core/PluginManager'
import { AddTrackWorkflowType } from '@jbrowse/core/pluggableElementTypes'
import { types } from 'mobx-state-tree'

// locals
import MultiWiggleWidget from './AddTrackWorkflow'

export default (pm: PluginManager) => {
  pm.addAddTrackWorkflowType(
    () =>
      new AddTrackWorkflowType({
        name: 'Multi-wiggle track',
        /* in a separate file, export the react component to render within the track widget,
        typically a form to collect relevant data for your track */
        ReactComponent: MultiWiggleWidget,
        stateModel: types.model({}),
      }),
  )
}
```

...and ensure you install this component into your larger plugin:

```js
// plugins/wiggle/index.jsx

// ...

export default class WigglePlugin extends Plugin {
  name = 'WigglePlugin'

  install(pm: PluginManager) {
    // ...
    MultiWiggleAddTrackWidgetF(pm)
    // ...
  }
}
```

### Extension points

Extension points are a pluggable element type which allows users to add a
callback that is called at an appropriate time.

Checkout the [full extension point API](../api_guide/#extension-points) or an [example for adding context menu items](../devguide_pluggable_elements/#adding-track-context-menu-items) for more detailed information.

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
is passed as the new argument to the second, and so on (they are chained together).

So in the example above, ret would be `{value:3}` after evaluating the
extension point.

## Next steps

Now that you have an overview of the different pluggable element types that are available to you, review your [understanding of the configuration model](../devguide_config), or checkout [creating your own pluggable elements](../devguide_pluggable_elements) for specific guides for making new adapters, tracks, and renderers.

Also checkout the [guided tutorial](../tutorials/simple_plugin_tutorial/01_introduction) for writing a plugin, which will take you through everything from installation, creating a new pluggable element, and general development tips for working with JBrowse 2.
