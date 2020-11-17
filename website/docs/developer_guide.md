---
id: developer_guide
title: Developer guide
toplevel: true
---

In this Developer Guide, will introduce the JBrowse 2 ecosystem from the
developer's point of view. We'll examine the core concepts of how code is
packaged and structured, and then go over how to create new plugins and
pluggable elements.

## Introduction and overview

Let's get a high-level view of the JBrowse 2 ecosystem.

## Products and plugins

The JBrowse 2 ecosystem has two main type of top-level artifacts that are
published on their own: products and plugins.

![](./img/products_and_plugins.png)

Architecture diagram of JBrowse 2, showing how plugins encapsulate views (e.g.
LinearGenomeView, DotplotView etc.), tracks (AlignmentsTrack, VariantTrack,
etc.), data adapters (BamAdapter, VcfTabixAdapter, etc.) and other logic like
mobx state tree autoruns that add logic to other parts of the app (e.g. adding
context menus)

A "product" is an application of some kind that is published on its own (a web
app, an electron app, a CLI app, etc). `jbrowse-web`, `jbrowse-desktop`, and
`jbrowse-cli` are products.

A "plugin" is a package of functionality that is designed to "plug in" to a
product **at runtime** to add functionality. These can be written and published
by anyone, not just the JBrowse core team. Not all of the products use plugins,
but most of them do.

Also, most of the products are pretty standard in the way they are constructed.
For example, jbrowse-web is a React web application that is made with [Create
React App (CRA)](https://create-react-app.dev/), and jbrowse-cli is a
command-line tool implemented with [OCLIF](https://oclif.io/).

![](./img/product_architecture.png)
This figure summarizes the general architecture of our state model and React
component tree

## What's in a plugin

A plugin is an independently distributed package of code that is designed to
"plug in" to a JBrowse application.

It's implemented as a class that extends `@jbrowse/core/Plugin`. It gets
instantiated by the application that it plugs into, and it has an `install`
method and a `configure` method that the application calls. This class is
distributed as a webpack bundle that exports it to a namespace on the browser's
`window` object specifically for JBrowse plugins[^1].

It's common for a plugin to use have its `configure` method set up [mobx
autoruns or reactions](https://mobx.js.org/refguide/autorun.html) that react to
changes in the application's state to modify its behavior.

Plugins often also have their `install` method add "pluggable elements" into
the host JBrowse application. This is how plugins can add new kinds of views,
tracks, renderers, and so forth.

[^1]: This means it's only possible to have one version of a particular plugin loaded on any given webpage, even if multiple products are loaded and using it on the same page.

## Pluggable elements

Pluggable elements are basic "extension points" that you can customize in
JBrowse 2 plugins

The pluggable types that we have in JBrowse 2 are

- Data adapters
- Track types
- Renderer types
- Widgets
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
see [creating data adapters](developer_guide#creating-data-adapters))

Example data adapters: the `@jbrowse/plugin-alignments` plugin creates
multiple data adapter types

- `BamAdapter` - This adapter uses the `@gmod/bam` NPM module, and adapts it
  for use by the browser.
- `CramAdapter` - This adapter uses the `@gmod/cram` NPM module. Note that
  CramAdapter also takes a sequenceAdapter as a subadapter configuration, and
  uses getSubAdapter to instantiate it
- `SNPCoverageAdapter` - this adapter takes a `BamAdapter` or `CramAdapter` as a
  subadapter, and calculates feature coverage from it

### Renderers

Renderers are a new concept in JBrowse 2, and are related to the concept of
server side rendering (SSR), but can be used not just on the server but also in
contexts like the web worker (e.g. the webworker can draw the features to an
OffscreenCanvas). For more info see [creating
renderers](developer_guide#creating-custom-renderers)

Example renderers: the `@jbrowse/plugin-alignments` exports several
renderer types

- `PileupRenderer` - a renderer type that renders Pileup type display of
  alignments fetched from the `BamAdapter`/`CramAdapter`
- `SNPCoverageRenderer` - a renderer that draws the coverage. Note that this
  renderer derives from the wiggle renderer, but does the additional step of
  drawing the mismatches over the coverage track

### Track types

Track types are a high level type that controls how features are drawn. In most
cases, a track combines a renderer and an adapter, and can do additional things like

- Control what widget pops up on feature click
- Add extra menu items to the track menu
- Create subtracks (See `AlignmentsTrack`)
- Choose "static-blocks" rendering styles, which keeps contents stable while
  the user scrolls, or "dynamic-blocks" that update on each scroll

Example tracks: the `@jbrowse/plugin-alignments` exports multiple track
types

- `SNPCoverageTrack` - this track type actually derives from the WiggleTrack type
- `PileupTrack` - a track type that draws alignment pileup results
- `AlignmentsTrack` - combines `SNPCoverageTrack` and `PileupTrack` as "subtracks"

### Widgets

Widgets are custom info panels that can show up in side panels, modals, or other
places in an app

Widgets can do multiple types of things including

- Configuration widget
- Feature detail widget
- Add track widget
- Add connection widget
- etc.

These widgets can be extended via plugins, so for example, the
`@jbrowse/plugin-alignments` extends the `BaseFeatureDetailWidget` to
have custom display of the alignments

- `AlignmentsFeatureDetailWidget` - this provides a custom widget
  for viewing the feature details of alignments features that customizes the
  basic feature detail widget

### View types

Creating view types is one of the most powerful features of JBrowse 2, because
it allows us to put entirely different visualizations in the same context as
the standard linear-genome-view.

We have demonstrated a couple new view types in JBrowse 2 already including

- `LinearGenomeView` - the classic linear view of a genome
- `CircularView` - a Circos-style whole genome view
- `DotplotView` - a comparative 2-D genome view
- `SvInspectorView` - superview containing `CircularView` and `SpreadsheetView`
  subviews
- And more!

We think the boundaries for this are just your imagination, and there can also
be interplay between view types e.g. popup dotplot from a linear view, etc.

### RPC methods

Plugins can register their own RPC methods, which can allow them to offload
custom behaviors to a web-worker or server side process. The Wiggle track for
example registers `WiggleGetGlobalStats` and `WiggleGetMultiRegionStats`

### MenuItems

You can add menus or add items to existing menus in several places.

A MenuItem object defines the menu item's text, icon, action, and other
attributes.

Types of MenuItems:

- **Normal**: a standard menu item that performs an action when clicked
- **Checkbox**: a menu item that has a checkbox
- **Radio**: a menu item that has a radio button icon
- **Divider**: a horizontal line (not clickable) that can be used to visually
  divide menus
- **SubHeader**: text (not clickable) that can be used to visually label a
  section of a menu
- **SubMenu**: contains menu items, for making nested menus

| Name     | Description                                                                                                                                                                                              |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| type     | Options are 'normal', 'radio', 'checkbox', 'subMenu', 'subHeader', or 'divider'. If not provided, defaults to 'normal', unless a `subMenu` attribute is present, in which case it defaults to 'subMenu'. |
| label    | The text for the menu item. Not applicable to 'divider', required for all others.                                                                                                                        |
| subLabel | Additional descriptive text for the menu item. Not applicable to 'divider' or 'subHeader', optional for all others.                                                                                      |
| icon     | An icon for the menu item. Must be compatible with Material-UI's [Icons](https://material-ui.com/components/icons/). Not applicable to 'divider' or 'subHeader', optional for all others.                |
| disabled | Whether or not the menu item is disabled (meaning grayed out and not clickable). Not applicable to 'divider' or 'subHeader', optional for all others.                                                    |
| checked  | Whether or not the checkbox or radio button are selected. Only applicable to 'radio' and 'checkbox'                                                                                                      |
| onClick  | Callback of action to perform on click. Function signature is `(session) => undefined`. Required for 'normal', 'radio', and 'checkbox', not applicable to any others.                                    |
| subMenu  | An array of menu items. Applicable only to 'subMenu'.                                                                                                                                                    |

As an example, the here is an array of MenuItems and the resulting menu:

```js
;[
  {
    label: 'Normal menu item',
    icon: AddIcon,
    onClick: () => {},
  },
  {
    label: 'Normal',
    subLabel: 'with subLabel',
    icon: AddIcon,
    onClick: () => {},
  },
  {
    label: 'Disabled menu item',
    disabled: true,
    icon: AddIcon,
    onClick: () => {},
  },
  {
    type: 'radio',
    label: 'Radio checked',
    checked: true,
    onClick: () => {},
  },
  {
    type: 'radio',
    label: 'Radio unchecked',
    checked: false,
    onClick: () => {},
  },
  {
    type: 'checkbox',
    label: 'Checkbox checked',
    checked: true,
    onClick: () => {},
  },
  {
    type: 'checkbox',
    label: 'Checkbox unchecked',
    checked: false,
    onClick: () => {},
  },
  { type: 'divider' },
  { type: 'subHeader', label: 'This is a subHeader' },
  {
    label: 'SubMenu',
    subMenu: [
      {
        label: 'SubMenu item one',
        onClick: () => {},
      },
      {
        label: 'SubMenu item two',
        onClick: () => {},
      },
    ],
  },
]
```

![Demo menu](./img/menu_demo.png)
Figure showing all the options for track menus, generated by the code listing

### Adding a top-level menu

These are the menus that appear in the top bar of JBrowse Web and JBrowse
Desktop. By default there are `File` and `Help` menus. You can add your own menu,
or you can add menu items or sub-menus to the existing menus and sub-menus.

![File menu with submenu](./img/top_level_menus.png)

In the above screenshot, the `File` menu has several items and an `Add`
sub-menu, which has more items. You can have arbitrarily deep sub-menus.

You add menus in the `configure` method of your plugin. Not all JBrowse products
will have to-level menus, though. JBrowse Web and JBrowse Desktop have them, but
something like JBrowse Linear View (which is an just a single view designed to
be embedded in another page) does not. This means you need to check whether or
not menus are supported using `isAbstractMenuManager` in the `configure` method.
This way the rest of the plugin will still work if there is not a menu. Here's
an example that adds an "Open My View" item to the `File -> Add` menu.

```js
import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import InfoIcon from '@material-ui/icons/Info'

class MyPlugin extends Plugin {
  name = 'MyPlugin'

  install(pluginManager) {
    // install MyView here
  }

  configure(pluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['File', 'Add'], {
        label: 'Open My View',
        icon: InfoIcon,
        onClick: session => {
          session.addView('MyView', {})
        },
      })
    }
  }
}
```

This example uses `rootModel.appendToSubMenu`. These are all the
menu-manipulation methods available on the root model:

#### appendMenu

Add a top-level menu

##### Parameters

| Name     | Description                 |
| -------- | --------------------------- |
| menuName | Name of the menu to insert. |

##### Return Value

The new length of the top-level menus array

#### insertMenu

Insert a top-level menu

##### Parameters

| Name     | Description                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| menuName | Name of the menu to insert.                                                                                                                 |
| position | Position to insert menu. If negative, counts from the end, e.g. `insertMenu('My Menu', -1)` will insert the menu as the second-to-last one. |

##### Return Value

The new length of the top-level menus array

#### appendToMenu

Add a menu item to a top-level menu

##### Parameters

| Name     | Description                              |
| -------- | ---------------------------------------- |
| menuName | Name of the top-level menu to append to. |
| menuItem | Menu item to append.                     |

##### Return Value

The new length of the menu

#### insertInMenu

Insert a menu item into a top-level menu

##### Parameters

| Name     | Description                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| menuName | Name of the top-level menu to insert into.                                                                                                       |
| menuItem | Menu item to insert.                                                                                                                             |
| position | Position to insert menu item. If negative, counts from the end, e.g. `insertMenu('My Menu', -1)` will insert the menu as the second-to-last one. |

##### Return Value

The new length of the menu

#### appendToSubMenu

Add a menu item to a sub-menu

##### Parameters

| Name     | Description                                                                                   |
| -------- | --------------------------------------------------------------------------------------------- |
| menuPath | Path to the sub-menu to add to, starting with the top-level menu (e.g. `['File', 'Insert']`). |
| menuItem | Menu item to append.                                                                          |

##### Return Value

The new length of the sub-menu

#### insertInSubMenu

Insert a menu item into a sub-menu

##### Parameters

| Name     | Description                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| menuPath | Path to the sub-menu to add to, starting with the top-level menu (e.g. `['File', 'Insert']`).                                                    |
| menuItem | Menu item to insert.                                                                                                                             |
| position | Position to insert menu item. If negative, counts from the end, e.g. `insertMenu('My Menu', -1)` will insert the menu as the second-to-last one. |

##### Return Value

The new length of the sub-menu

### Adding menu items to a custom track

If you create a custom track, you can populate the track menu items in it using
the `trackMenuItems` property in the track model. For example:

```js
types
  .model({
    // model
  })
  .views(self => ({
    get trackMenuItems() {
      return [
        {
          label: 'Menu Item',
          icon: AddIcon,
          onClick: () => {},
        },
      ]
    },
  }))
```

### Adding track context menu items

When you right-click in a linear track, a context menu will appear if there are
any menu items defined for it. It's possible to add items to that menu, and you
can also have different menu items based on if the click was on a feature or
not, and based on what feature is clicked. This is done by adding a callback
that takes the feature and track and returns a list of menu items to add based
on those. This has to be done via a mobx `autorun` because it needs to add the
callback to tracks after they are created. Here is an example:

```js
class SomePlugin extends Plugin {
  name = 'SomePlugin'

  install(pluginManager) {
    // install some stuff
  }

  configure(pluginManager) {
    const menuItemCallback = (feature, track) => {
      const menuItem = {
        label: 'Some menu item',
        icon: SomeIcon,
        onClick: session => {
          // do some stuff
        },
      }
      return [menuItem]
    }

    const session = pluginManager.rootModel?.session
    autorun(() => {
      const views = session?.views

      views.forEach(view => {
        if (view.type === 'LinearGenomeView') {
          const { tracks } = view
          tracks.forEach(track => {
            if (
              track.type === 'VariantTrack' &&
              !track.additionalContextMenuItemCallbacks.includes(
                menuItemCallback,
              )
            ) {
              track.addAdditionalContextMenuItemCallback(menuItemCallback)
            }
          })
        }
      })
    })
  }
}
```

## Monorepo code organization

JBrowse 2 code is organized as a monorepo using [lerna](https://lerna.js.org/)
and [yarn workspaces](https://classic.yarnpkg.com/en/docs/workspaces/). Using a
monorepo means that instead of separate GitHub repositories for each piece of
JBrowse, they are all in a single place and can share code easily. In the top
level of the repository there are two directories, `packages/` and `products/`
that each contain multiple packages.

Each "package" is an npm-style (i.e. contains `package.json`) package. The
packages in `packages/` are core code, development tools, etc. The packages in
`plugins/` are JBrowse plugins. Most of JBrowse is written as plugins, so that
is where most of the code is. The packages in `products/` are user-facing
products, such as JBrowse Web, JBrowse Desktop, JBrowse CLI, etc.

### Monorepo packages

The following is a summary of some of the individual packages in the monorepo.
It's not a comprehensive list, but will hopefully help familiarize you with how
the code is organized.

#### products/jbrowse-web

This is the full JBrowse Web app. It is built using
[create-react-app](https://create-react-app.dev/).

It includes many other packages as core plugins, can load other plugins at
runtime, and more.

It also currently holds the "integration tests" that we use for our code in
`products/jbrowse-web/src/tests`.

#### products/jbrowse-desktop

JBrowse Desktop is our essentially the same as JBrowse Web, but packaged with
[electron](https://www.electronjs.org/) into a desktop app. This gives it the
ability to easily load and save tracks based on files on your local filesystem.
It also has save sessions locally, and works offline.

#### products/website

This provides the docusaurus website with docs, blog, and pdf documentation

#### plugins/alignments

This package provides the "alignments" related features including

- BamAdapter - our BAM parser that wraps @gmod/bam NPM module
- CramAdapter - our CRAM parser that wraps the @gmod/cram NPM module
- PileupTrack type - draws alignments as boxes in a "pileup" style view
- SNPCoverageTrack - draws calculated coverage with mismatches drawn over the coverage
- AlignmentsTrack - a "supertrack" which contains a PileupTrack and
  SNPCoverageTrack "subtracks"
- AlignmentsFeatureWidget for alignments features

#### plugins/variants/

Provides variant features including

- VCF tabix parser
- VariantFeatureWidget
- VariantTrack that is basically just a normal track, but has logic to popup
  the VariantFeatureWidget on feature click

#### plugins/hic

This provides a HicAdapter based on the .hic file format
([ref](https://github.com/aidenlab/juicer/wiki/Data#hic-files))

Also a track type and renderer to visualize these

#### plugins/bed

Provides two bed related data adapters

- BigBedAdapter
- BedTabixAdapter

These can be used with the SvgFeatureRenderer

#### plugins/wiggle

Provides wiggle track types with different types of rendering formats including

- XYPlotRenderer
- LinePlotRenderer
- DensityRenderer

The WiggleTrack type can swap out these different rendering types, and
calculates stats such as max and min score over a region before the region is
rendered

#### plugins/svg

This is the main gene glyphs, which are rendered using SVG

General usage of this involves referencing the SvgFeatureRenderer

#### plugins/spreadsheet-view

This provides a spreadsheet-in-the-browser that can be used as a data backend
to power other views

#### plugins/circular-view

This provides our 'Circos-style' whole-genome overview of data, especially
genomic translocations

#### plugins/sv-inspector

This is a "superview" type that contains a circular and spreadsheet view as
child views

### Plugin Build system

Plugins may be built as separate packages that can be distributed on NPM. In
order to streamline development and avoid having to build every plugin before
developing on e.g. JBrowse Web, however, the `package.json`'s "main" entry by
default points to the un-built code (e.g. `src/index.ts`). JBrowse Web then
takes care of building the plugins itself (see
`products/jbrowse-web/rescripts/yarnWorkspacesRescript.js`).

When you want to use a built plugin, you can run `yarn useDist` in the plugin's
`package.json`, and then run `yarn useSrc` to restore it when you're done. As an
example, the root-level `yarn build` that builds all the packages does this to
build all the plugins and then build JBrowse Web and JBrowse Desktop using the
built plugins.

## Configuration model concepts

### Configuration slot types

Our configuration system is "typed" to facilitate graphical editing of the
configuration. Each configuration has a "schema" that lists what
"configuration slots" it has. Each configuration slot has a name, description,
a type, and a value.

Here is a mostly comprehensive list of config types

- stringEnum - allows assigning one of a limited set of entries, becomes a
  dropdown box in the GUI
- color - allows selecting a color, becomes a color picker in the GUI
- number - allows entering any numeric value
- string - allows entering any string
- integer - allows entering a integer value
- boolean
- frozen - an arbitrary JSON can be specified in this config slot, becomes
  textarea in the GUI
- fileLocation - refers to a URL, local file path on desktop, or file blob
  object in the browser
- text - allows entering a string, becomes textarea in the GUI
- stringArray - allows entering a list of strings, becomes a "todolist" style
  editor in the GUI where you can add or delete things
- stringArrayMap - allows entering a list of key-value entries

Let's examine the PileupRenderer configuration as an example.

### Example config with multiple slot types

This PileupRenderer config contains an example of several different slot types

```js
import { types } from 'mobx-state-tree'
export default ConfigurationSchema('PileupRenderer', {
  color: {
    type: 'color',
    description: 'the color of each feature in a pileup alignment',
    defaultValue: `function(feature) {
        var s = feature.get('strand');
        return s === -1 ? '#8F8FD8': '#EC8B8B'
      }`,
    functionSignature: ['feature'],
  },
  displayMode: {
    type: 'stringEnum',
    model: types.enumeration('displayMode', ['normal', 'compact', 'collapse']),
    description: 'Alternative display modes',
    defaultValue: 'normal',
  },
  minSubfeatureWidth: {
    type: 'number',
    description: `the minimum width in px for a pileup mismatch feature. use for
        increasing mismatch marker widths when zoomed out to e.g. 1px or
        0.5px`,
    defaultValue: 0,
  },
  maxHeight: {
    type: 'integer',
    description: 'the maximum height to be used in a pileup rendering',
    defaultValue: 600,
  },
})
```

### Accessing config values

So instead of accessing `config.displayMode`, we say

```js
readConfObject(config, 'displayMode')
```

You might also see in the code like this

```js
getConf(track, 'maxHeight')
```

Which would be equivalent to calling

```js
readConfObject(track.configuration, 'maxHeight')`
```

### Using config callbacks

Config callbacks allow you to have a dynamic color based on some function logic
you provide. All config slots can actually become config callback. The
arguments that are given to the callback are listed by the 'functionSignature'
but must be provided by the calling code (the code reading the config slot). To
pass arguments to the a callback we say

```js
readConfObject(config, 'color', [feature])
```

That implies the color configuration callback will be passed a feature, so the
config callback can be a complex function determining the color to use based on
various feature attributes

### Example of a config callback

If you had an variant track in your config, and wanted to make a custom config
callback for color, it might look like this

```json
{
  "type": "VariantTrack",
  "trackId": "myvcf",
  "name": "My variants",
  "assemblyNames": ["h19"],
  "category": ["VCF"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "vcfGzLocation": {
      "uri": "test_data/volvox/volvox.filtered.vcf.gz"
    },
    "index": {
      "location": {
        "uri": "test_data/volvox/volvox.filtered.vcf.gz.tbi"
      }
    }
  },
  "renderers": {
    "SvgFeatureRenderer": {
      "type": "SvgFeatureRenderer",
      "color": "function(feat) { return feat.get('type')==='SNV'?'green':'purple' }"
    }
  }
}
```

This draws all SNV (single nucleotide variants) as green, and other types as
purple (insertion, deletion, other structural variant). Note that JSON format
doesn't allow fancy multiline

### Configuration internals

A configuration is a type of mobx-state-tree model, in which leaf nodes are
ConfigSlot types, and other nodes are ConfigurationSchema types.

```
       Schema
    /     |     \
   Slot  Schema  Slot
         |    \
         Slot  Slot
```

Configurations are all descendants of a single root configuration, which is
`root.configuration`.

Configuration types should always be created by the `ConfigurationSchema`
factory, e.g.

```js
import { ConfigurationSchema } from '@jbrowse/core/utils/configuration'
const ThingStateModel = types.model('MyThingsState', {
  foo: 42,
  configuration: ConfigurationSchema('MyThing', {
    backgroundColor: {
      defaultValue: 'white',
      type: 'string',
    },
  }),
})
```

An example of a config schema with a sub-config schema is the BamAdapter, with
the index sub-config schema

```js
ConfigurationSchema(
  'BamAdapter',
  {
    bamLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bam' },
    },
    // this is a sub-config schema
    index: ConfigurationSchema('BamIndex', {
      indexType: {
        model: types.enumeration('IndexType', ['BAI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'BAI',
      },
      location: {
        type: 'fileLocation',
        defaultValue: { uri: '/path/to/my.bam.bai' },
      },
    }),
  },
  { explicitlyTyped: true },
)
```

Reading the sub-config schema is as follows

```js
const indexType = readConfObject(config, ['index', 'indexType'])
```

## Creating data adapters

### What is a data adapter

A data adapter is essentially a class that parses your data type and returns
features that jbrowse will draw

Sometimes, a data adapter can be implemented by itself, e.g. if you are
adapting a storeclass that returns genes, then you can use our standard track
types for that. If you are making a data adapter for some custom type of data
that also needs a custom type of drawing, you may need to implement a data
adapter along with a track type and/or renderer

### Skeleton of a data adapter

So we see basically something like this, this is stripped down for simplicity

```js
class MyAdapter extends BaseFeatureDataAdapter {
  constructor(config) {
    // config
  }
  async getRefNames() {
    // return ref names used in your data adapter, used for refname renaming
  }
  getFeatures(region) {
    // return features from your data adapter, using rxjs observable
  }
  freeResources(region) {
    // can be empty
  }
}
```

So to make a data adapter, you implement the getRefNames function (optional),
the getFeatures function (returns an rxjs observable stream of features,
discussed below) and freeResources (optional)

### Example data adapter

To take this a little slow let's look at each function individually

This is a more complete description of the class interface that you can implement

```js
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { readConfObject } from '@jbrowse/core/configuration'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

class MyAdapter extends BaseFeatureDataAdapter {
  // @param config - a configuration object
  // @param getSubAdapter - function to initialize additional subadapters
  constructor(config, getSubAdapter) {
    const fileLocation = readConfObject(config, 'fileLocation')
    const subadapter = readConfObject(config, 'sequenceAdapter')
    const sequenceAdapter = getSubAdapter(subadapter)
  }

  // @param region - { refName:string, start:number, end:number}
  // @param options - { signal: AbortSignal, bpPerPx: number }
  // @return an rxjs Observable
  getFeatures(region, options) {
    return ObservableCreate(async observer => {
      try {
        const myapi = await fetch(
          'http://myservice/genes/${refName}/${start}-${end}',
        )
        if (result.ok) const features = await result.json()
        features.forEach(feature => {
          observer.next(
            new SimpleFeature({
              uniqueID: `${feature.chr}-${feature.start}-${feature.end}`,
              refName: feature.chr,
              start: feature.start,
              end: feature.end,
            }),
          )
        })
        observer.complete()
      } catch (e) {
        observer.error(e)
      }
    })
  }

  async getRefNames() {
    // returns the list of refseq names in the file, used for refseq renaming
    // you can hardcode this if you know it ahead of time e.g. for your own
    // remote data API or fetch this from your data file e.g. from the bam header
    return ['chr1', 'chr2', 'chr3'] /// etc
  }

  freeResources(region) {
    // optionally remove cache resources for a region
    // can just be an empty function
  }
}
```

### What is needed from a data adapter

#### getRefNames

Returns the refNames that are contained in the file, this is
used for "refname renaming" and is optional but highly useful in scenarios
like human chromosomes which have, for example, chr1 vs 1.

Returning the refNames used by a given file or resource allows JBrowse to
automatically smooth these small naming disparities over. See [reference
renaming](config_guide#configuring-reference-renaming)

#### getFeatures

A function that returns features from the file given a genomic
range query e.g. getFeatures(region, options), where region is an object like

The region contains

```typescript
interface Region {
  refName: string
  start: number
  end: number
  originalRefName: string
  assemblyName: string
}
```

The options can contain any number of things

```typescript
interface Options {
  bpPerPx: number
  signal: AbortSignal
  statusCallback: Function
  headers: Record<string, string>
}
```

- bpPerPx - number: resolution of the genome browser when the features were
  fetched
- signal - can be used to abort a fetch request when it is no longer needed,
  from AbortController
- statusCallback - not implemented yet but in the future may allow you to
  report the status of your loading operations
- headers - set of HTTP headers as a JSON object

We return an rxjs Observable. This is similar to a JBrowse 1 getFeatures call,
where we pass each feature to a featureCallback, tell it when we are done with
finishCallback, and send errors to errorCallback, except we do all those things
with the Observable

Here is a "conversion" of JBrowse 1 getFeatures callbacks to JBrowse 2
observable calls

- `featureCallback(new SimpleFeature(...))` -> `observer.next(new SimpleFeature(...))`
- `finishCallback()` -> `observer.complete()`
- `errorCallback(error)` -> `observer.error(error)`

#### freeResources

This is uncommonly used, so most data adapters make this an empty function

Most data adapters in fact use an LRU cache to make resources go away over time
instead of manually cleaning up resources

## Creating a new plugin

JBrowse 2 plugins can be used to add new pluggable elements (views, tracks,
data adapters, etc), and to modify behavior of the application by adding code
that watches the application's state. For the full list of what kinds of
pluggable element types plugins can add, see the [pluggable
elements](developer_guide#pluggable-elements) page.

We will go over creating an example plugin. The first thing that we have is a
`src/index.js` which exports a default class containing the plugin registration
code

src/index.js

```js
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import Plugin from '@jbrowse/core/Plugin'
import { AdapterClass, configSchema } from './UCSCAdapter'

export default class UCSCPlugin extends Plugin {
  name = 'UCSCPlugin'
  install(pluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'UCSCAdapter',
          configSchema,
          AdapterClass,
        }),
    )
  }
}
```

src/UCSCAdapter/index.ts

```js
import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import stringify from 'json-stable-stringify'

export const configSchema = ConfigurationSchema(
  'UCSCAdapter',
  {
    base: {
      type: 'fileLocation',
      description: 'base URL for the UCSC API',
      defaultValue: {
        uri: 'https://cors-anywhere.herokuapp.com/https://api.genome.ucsc.edu/',
      },
    },
    track: {
      type: 'string',
      description: 'the track to select data from',
      defaultValue: '',
    },
  },
  { explicitlyTyped: true },
)

export class AdapterClass extends BaseFeatureDataAdapter {
  constructor(config) {
    super(config)
    this.config = config
  }

  getFeatures(region) {
    const { assemblyName, start, end, refName } = region
    return ObservableCreate(async observer => {
      const { uri } = readConfObject(this.config, 'base')
      const track = readConfObject(this.config, 'track')
      try {
        const result = await fetch(
          `${uri}/getData/track?` +
            `genome=${assemblyName};track=${track};` +
            `chrom=${refName};start=${start};end=${end}`,
        )
        if (result.ok) {
          const data = await result.json()
          data[track].forEach(feature => {
            observer.next(
              new SimpleFeature({
                ...feature,
                start: feature.chromStart,
                end: feature.chromEnd,
                refName: feature.chrom,
                uniqueId: stringify(feature),
              }),
            )
          })
          observer.complete()
        }
      } catch (e) {
        observer.error(e)
      }
    })
  }

  async getRefNames() {
    const arr = []
    for (let i = 0; i < 23; i++) {
      arr.push(`chr${i}`)
    }
    return arr
  }

  freeResources() {}
}
```

### Adding this track to our configuration

We can create a track.json like this

track.json

```json
{
  "type": "BasicTrack",
  "trackId": "genehancer_ucsc",
  "name": "UCSC GeneHancer",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "UCSCAdapter",
    "track": "geneHancerInteractionsDoubleElite"
  },
  "renderer": {
    "type": "SvgFeatureRenderer"
  }
}
```

Then use the jbrowse CLI tool add-track-json

```sh
jbrowse add-track-json file.json
```

This will automatically add this track to the tracks array of our config.json

Alternatively, we can manually edit this JSON into the config.json.

When we open this track, we should see the GeneHancer regions are drawn as
orange blocks.

### Creating a custom renderer type

Let's say we want to create a track that connects a gene to it's enhancer. On
UCSC the GeneHancer tracks do exactly this. An instance of the UCSC with the
GeneHancer tracks is [here](https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&lastVirtModeType=default&lastVirtModeExtraState=&virtModeType=default&virtMode=0&nonVirtPosition=&position=chrX%3A15568963%2D15611770&hgsid=858794487_a0hr9rIWlxlrERnwnX2RjVOEl7rJ).

We can see data that we can get for the GeneHancer interactions from the UCSC
API like this

```sh
curl 'https://api.genome.ucsc.edu/getData/track?genome=hg19;\
track=geneHancerInteractionsDoubleElite;chrom=chr1;start=750000;\
end=505700000'|less
```

Given that the functionality of rendering arcs is so distinct from UCSC API
adaptation, we can actually make this a new plugin. Let's imagine starting a
new plugin from scratch again

src/index.js

```js
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'

import ArcRenderer, {
  configSchema as ArcRendererConfigSchema,
  ReactComponent as ArcRendererReactComponent,
} from './ArcRenderer'

export default class ArcRendererPlugin extends Plugin {
  name = 'ArcPlugin'
  install(pluginManager) {
    pluginManager.addRendererType(
      () =>
        // @ts-ignore error "expected 0 arguments, but got 1"?
        new ArcRenderer({
          name: 'ArcRenderer',
          ReactComponent: ArcRendererReactComponent,
          configSchema: ArcRendererConfigSchema,
        }),
    )
  }
}
```

src/ArcRenderer/index.js

```js
import React from 'react'
// prettier-ignore
import {
  ServerSideRendererType
} from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { bpSpanPx } from '@jbrowse/core/util'
import {
  createCanvas,
  createImageBitmap,
} from '@jbrowse/core/util/offscreenCanvasPonyfill'

// Our config schema for arc track will be basic, include just a color
export const configSchema = ConfigurationSchema(
  'ArcRenderer',
  {
    color: {
      type: 'color',
      description: 'color for the arcs',
      defaultValue: 'darkblue',
    },
  },
  { explicitlyTyped: true },
)

// This ReactComponent is the so called "rendering" which is the component
// that contains the contents of what was rendered.
export const ReactComponent = props => {
  return (
    <div style={{ position: 'relative' }}>
      <PrerenderedCanvas {...props} />
    </div>
  )
}

// Our ArcRenderer class does the main work in it's render method
// which draws to a canvas and returns the results in a React component
export default class ArcRenderer extends ServerSideRendererType {
  async render(renderProps) {
    const {
      features,
      config,
      regions,
      bpPerPx,
      highResolutionScaling,
    } = renderProps
    const region = regions[0]
    const width = (region.end - region.start) / bpPerPx
    const height = 500
    const canvas = createCanvas(
      width * highResolutionScaling,
      height * highResolutionScaling,
    )
    const ctx = canvas.getContext('2d')
    ctx.scale(highResolutionScaling, highResolutionScaling)
    for (const feature of features.values()) {
      const [left, right] = bpSpanPx(
        feature.get('start'),
        feature.get('end'),
        region,
        bpPerPx,
      )

      ctx.beginPath()
      ctx.strokeStyle = readConfObject(config, 'color', [feature])
      ctx.lineWidth = 3
      ctx.moveTo(left, 0)
      ctx.bezierCurveTo(left, 200, right, 200, right, 0)
      ctx.stroke()
    }
    const imageData = await createImageBitmap(canvas)
    const element = React.createElement(
      this.ReactComponent,
      {
        ...renderProps,
        width,
        height,
        imageData,
      },
      null,
    )
    return { element, imageData, width, height }
  }
}
```

The above code is relatively simple but it is fairly quirky. Here are some notes:

- renderers can be run in offscreen or even a node.js canvas, so we do not
  assume the `document.createElement` exists to create our canvas, instead
  using a utility function that makes a OffscreenCanvas or node-canvas (depends
  on context, e.g. webworker or node.js)
- the "rendering" component contains the results of our renderer. in this case
  it delegates to the `PrerenderedCanvas` component, a component we use in other
  places throughout the codebase

### Bringing the two together

We can bring these two contexts together with a new track in our config.json.
Remember our previous track.json? Now we can edit it to use our own ArcRenderer

track.json

```json
{
  "type": "BasicTrack",
  "trackId": "genehancer_ucsc",
  "name": "UCSC GeneHancer",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "UCSCAdapter",
    "track": "geneHancerInteractionsDoubleElite"
  },
  "renderer": {
    "type": "ArcRenderer"
  }
}
```

Then add the track

```sh
jbrowse add-track-json track.json --update
```

## Creating custom renderers

### What is a renderer

In JBrowse 1, a track type typically would directly call the data parser and do
it's own rendering. In JBrowse 2, the data parsing and rendering is offloaded
to a web-worker or other RPC. This allows things to be faster in many cases.
This is conceptually related to "server side rendering" or SSR in React terms.

![](./img/renderer.png)
Conceptual diagram of how a track calls a renderer using the RPC

Important note: you can make custom tracks types that do not use this workflow,
but it is a built in workflow that works well for the core track types in
JBrowse 2.

### How to create a new renderer

The fundamental aspect of creating a new renderer is creating a class that
implements the "render" function. A renderer is actually a pair of a React
component that contains the renderer's output, which we call the "rendering"
and the renderer itself

```js
class MyRenderer implements ServerSideRendererType {
  render(props) {
    const { width, height, regions, features } = props
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'red'
    ctx.drawRect(0, 0, 100, 100)
    const imageData = createImageBitmap(canvas)
    return {
      element: React.createElement(this.ReactComponent, { ...props }),
      imageData,
      height,
      width,
    }
  }
}
```

In the above simplified example, our renderer creates a canvas using width and
height that are supplied via arguments, and draw a rectangle. We then return a
React.createElement call which creates a "rendering" component that will
contain the output

Note that the above canvas operations use an OffscreenCanvas for Chrome, or in
other browsers serialize the drawing commands to be drawn in the main thread

### What are the props passed to the renderer

The typical props that a renderer receives

```typescript
export interface PileupRenderProps {
  features: Map<string, Feature>
  layout: { addRect: (featureId, leftBp, rightBp, height) => number }
  config: AnyConfigurationModel
  regions: Region[]
  bpPerPx: number
  height: number
  width: number
  highResolutionScaling: number
}
```

The layout is available on BoxRendererType renderers so that it can layout
things in pileup format, and has an addRect function to get the y-coordinate to
render your data at

The features argument is a map of feature ID to the feature itself. To iterate
over the features Map, we can use an iterator or convert to an array

```js
class MyRenderer extends ServerSideRendererType {
  render(props) {
    const { features, width, height } = props
    // iterate over the ES6 map of features
    for (const feature in features.values()) {
      // render each feature to canvas or output SVG
    }

    // alternatively
    const feats = Array.from(features.values())
    feats.forEach(feat => {})
  }
}
```

### Adding custom props to the renderer

Note that track models themselves can extend this using their renderProps function

For example the WiggleTrack has code similar to this, which adds a scaleOpts
prop that gets passed to the renderer

```js
const model = types
  .compose(
    'WiggleTrack',
    blockBasedTrack,
    types.model({
      type: types.literal('WiggleTrack'),
    }),
  )
  .views(self => ({
    get renderProps() {
      return {
        ...self.composedRenderProps, // props that the blockBasedTrack adds,
        ...getParentRenderProps(self), // props that the view wants to add,
        scaleOpts: {
          domain: this.domain,
          stats: self.stats,
          autoscaleType: getConf(self, 'autoscale'),
          scaleType: getConf(self, 'scaleType'),
          inverted: getConf(self, 'inverted'),
        },
      }
    },
  }))
```

### Rendering SVG

Our SVG renderer is an example, where it extends the existing built in renderer
type with a custom ReactComponent only

```js
export default class SVGPlugin extends Plugin {
  install(pluginManager: PluginManager) {
    pluginManager.addRendererType(
      () =>
        new BoxRendererType({
          name: 'SvgFeatureRenderer',
          ReactComponent: SvgFeatureRendererReactComponent,
          configSchema: svgFeatureRendererConfigSchema,
        }),
    )
  }
}
```

Then, we have our Rendering component just be plain React code. This is a
highly simplified SVG renderer just to illustrate

```jsx
export default function SvgFeatureRendering(props) {
  const { width, features, regions, layout, bpPerPx } = props
  const region = regions[0]

  const feats = Array.from(features.values())
  const height = readConfObject(config, 'height', [feature])
  return (
    <svg>
      {feats.map(feature => {
        // our layout determines at what y-coordinate to
        // plot our feature, given all the other features
        const top = layout.addRect(
          feature.id(),
          feature.get('start'),
          feature.get('end'),
          height,
        )
        const [left, right] = bpSpanPx(
          feature.get('start'),
          feature.get('end'),
          region,
          bpPerPx,
        )
        return <rect x={left} y={top} height={height} width={right - left} />
      })}
    </svg>
  )
}
```

Notes:

- The above SVG renderer is highly simplified but serves an example, but it
  shows that you can have a simple React component that leverages the existing
  BoxRendererType, so that you do not have to necessarily create your own
  renderer class
- The renderers receive an array of regions to render, but if they are only
  equipped to handle one region at a time then they can select only rendering
  to regions[0]

### Overriding the renderer's getFeatures method

Normally, it is sufficient to override the getFeatures function in your
dataAdapter

If you want to drastically modify the feature fetching behavior, you can modify
the renderer's getFeatures call

The base ServerSideRendererType class has a built-in getFeatures function that,
in turn, calls your data adapter's getFeatures function, but if you need
tighter control over how your data adapter's getFeatures method is called then
your renderer. The Hi-C renderer type does not operate on conventional
features and instead works with contact matrices, so the Hi-C renderer has a
custom getFeatures function

```js
import { toArray } from 'rxjs/operators'
class HicRenderer extends ServerSideRendererType {
  async getFeatures(args) {
    const { dataAdapter, regions } = args
    const features = await dataAdapter
      .getFeatures(regions[0])
      .pipe(toArray())
      .toPromise()
    return features
  }
}
```

## Creating custom track types

At a high level the track types are just "ReactComponents" that contain
rendered track contents. Oftentimes, for custom drawing, we create a renderer
instead of a track, but here are some reasons you might want a custom track

- Drawing custom things over the rendered content (e.g. drawing the Y-scale bar
  in the wiggle track)
- Implementing custom track menu items (e.g. Show soft clipping in the
  alignments track)
- Adding custom widgets (e.g. custom VariantFeatureWidget in
  variant track)
- You want to bundle your renderer and adapter as a specific thing that is
  automatically initialized rather than the BasicTrack (which combines any
  adapter and renderer)

### What does creating a track look like

When you create your plugin, you will add a cCreating a custom track is
basically looks like this

You have your config schema

```js
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BasicTrackConfig } from '@jbrowse/plugin-linear-genome-view'

const configSchema = ConfigurationSchema(
  'MyTrack',
  {
    color: {
      type: 'string',
      description: 'the color to use on my special features',
      defaultValue: 'green',
    },
  },
  { baseConfiguration: BasicTrackConfig, explicitlyTyped: true },
)
```

### What are the details of configSchema and stateModel

- stateModel - a mobx-state-tree object that manages track logic
- configSchema - a combination of a "stateModel" and a "configSchema"

The state model is often implemented as a composition of the "base track" and
some custom logic

```js
import { observer } from 'mobx-react'
import { types } from 'mobx-state-tree'
import { BlockBasedTrack } from '@jbrowse/plugin-linear-genome-view'

// A component which changes color when you click on it
// Note that this track is an observer, so it automatically re-renders
// when something inside the track model changes e.g. model.hasTheBellRung
const BackgroundChangeTrack = observer(props => {
  const { model } = props
  return (
    <div
      style={{ backgroundColor: model.hasTheBellRung ? 'red' : 'green' }}
      onClick={() => model.ringTheBell()}
    >
      <BlockBasedTrack {...props} />
    </div>
  )
})

// A track state model that implements the logic for changing the
// background color on user click
return types.compose(
  'BackgroundChangeTrack',
  BaseTrack,
  types
    .model({
      hasTheBellRung: false,
    })
    .volatile(() => ({
      ReactComponent: MyComponent,
    }))
    .actions(self => ({
      ringTheBell() {
        self.hasTheBellRung = true
      },
    })),
)
```

This custom track type is fairly silly, but it shows us that our "track" can
really be any React component that we want it to, and that we can control some
logical state of the track by using mobx-state-tree

### Putting it all together

Here is a complete plugin that creates it's ReactComponent, configSchema,
stateModel, and Plugin class in a single file. You are of course welcome to
split things up into different files in your own plugins :)

src/index.js

```js
import { observer } from 'mobx-react'
import { types } from 'mobx-state-tree'
import { BlockBasedTrack } from '@jbrowse/plugin-linear-genome-view'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BasicTrackConfig } from '@jbrowse/plugin-linear-genome-view'
import Plugin from '@jbrowse/core/Plugin'

const BackgroundChangeTrack = observer(props => {
  const { model } = props
  return (
    <div
      style={{ backgroundColor: model.hasTheBellRung ? 'red' : 'green' }}
      onClick={() => model.ringTheBell()}
    >
      <BlockBasedTrack {...props} />
    </div>
  )
})

const stateModel = types.compose(
  'BackgroundChangeTrack',
  BaseTrack,
  types
    .model({
      hasTheBellRung: false,
    })
    .volatile(() => ({
      ReactComponent: MyComponent,
    }))
    .actions(self => ({
      ringTheBell() {
        self.hasTheBellRung = true
      },
    })),
)

const configSchema = ConfigurationSchema(
  'MyTrack',
  {
    color: {
      type: 'string',
      description: 'the color to use on my special features',
      defaultValue: 'green',
    },
  },
  { baseConfiguration: BasicTrackConfig, explicitlyTyped: true },
)

export default class MyPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addTrackType(() => {
      return new TrackType({
        name: 'MyTrack',
        compatibleView: 'LinearGenomeView', // this is the default
        configSchema,
        stateModel,
      })
    })
  }
}
```
