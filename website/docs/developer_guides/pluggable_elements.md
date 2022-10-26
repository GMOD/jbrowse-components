---
id: devguide_pluggable_elements
title: Examples of plugin functionality
toplevel: true
---

import Figure from '../figure'

This guide will walk you through the concepts necessary for creating your own
of some of the most common pluggable element types, including **adapters**,
**tracks**, and **renderers**.

## Simple additions to JBrowse using plugins

### Adding a top-level menu

These are the menus that appear in the top bar of JBrowse Web and JBrowse
Desktop. By default, there are `File`, `Add`, `Tools`, and `Help` menus.

You can add your own menu, or you can add menu items or sub-menus to the
existing menus and sub-menus. Sub-menus can be arbitrarily deep.

<Figure src="/img/top_level_menus.png" caption="In the above screenshot, the `Add` menu provides quick access to adding a view via the UI; this is a good place to consider adding your own custom view type."/>

You add menus in the `configure` method of your plugin. Not all JBrowse
products will have top-level menus, though. JBrowse Web and JBrowse Desktop
have them, but something like JBrowse Linear View (which is an just a single
view designed to be embedded in another page) does not. This means you need to
check whether or not menus are supported using `isAbstractMenuManager` in the
`configure` method. This way the rest of the plugin will still work if there is
not a menu. Here's an example that adds an "Open My View" item to the `Add` menu.

```js
import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import InfoIcon from '@mui/icons-material/Info'

class MyPlugin extends Plugin {
  name = 'MyPlugin'

  install(pluginManager) {
    // install MyView here
  }

  configure(pluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Add', {
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

This example uses `rootModel.appendToMenu`. See [top-level menu
API](../api_guide#rootmodel-menu-api) for more details on available functions.

### Adding menu items to a custom track

If you create a custom track, you can populate the track menu items in it using
the `trackMenuItems` property in the track model. For example:

```js
types
  .model({
    // model
  })
  .views(self => ({
    trackMenuItems() {
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

If you'd prefer to append your track menu items onto menu items available from the
base display, you can grab the `trackMenuItems` property from the extended model
and redefine trackMenuItems with your new Menu Item appended at the end, like so:

```js
types
  .model({
    // model
  })
  .views(self => {
    const { trackMenuItems: superTrackMenuItems } = self
    return {
      get trackMenuItems() {
        return [
          ...superTrackMenuItems(),
          {
            label: 'Menu Item',
            icon: AddIcon,
            onClick: () => {},
          },
        ]
      },
    }
  })
```

### Adding track context-menu items

When you right-click in a linear track, a context menu will appear if there are
any menu items defined for it.

<Figure src="/img/linear_align_ctx_menu.png" caption="A screenshot of a context menu available on a linear genome view track. Here, we see the context menu of a feature right-clicked on a LinearAlignmentsDisplay."/>

It's possible to add items to that menu, and you
can also have different menu items based on if the click was on a feature or
not, and based on what feature is clicked. This is done by extending the
`contextMenuItems` view of the display model. Here is an example:

```js
class SomePlugin extends Plugin {
  name = 'SomePlugin'

  install(pluginManager) {
    pluginManager.addToExtensionPoint(
      'Core-extendPluggableElement',
      pluggableElement => {
        if (pluggableElement.name === 'LinearPileupDisplay') {
          const { stateModel } = pluggableElement
          const newStateModel = stateModel.extend(self => {
            const superContextMenuItems = self.contextMenuItems
            return {
              views: {
                contextMenuItems() {
                  const feature = self.contextMenuFeature
                  if (!feature) {
                    // we're not adding any menu items since the click was not
                    // on a feature
                    return superContextMenuItems()
                  }
                  return [
                    ...superContextMenuItems(),
                    {
                      label: 'Some menu item',
                      icon: SomeIcon,
                      onClick: () => {
                        // do some stuff
                      },
                    },
                  ]
                },
              },
            }
          })

          pluggableElement.stateModel = newStateModel
        }
        return pluggableElement
      },
    )
  }
}
```

## Creating adapters

### What is an adapter

An adapter is essentially a class that fetches and parses your data and returns
it in a format JBrowse understands.

For example, if you have some data source that contains genes, and you want to
display those genes using JBrowse's existing gene displays, you can write a
custom adapter to do so. If you want to do a custom display of your data,
though, you'll probably need to create a custom display and/or renderer along
with your adapter.

### What types of adapters are there

- **Feature adapter** - This is the most common type of adapter. Essentially,
  it takes a request for a _region_ (a chromosome, starting position, and ending
  position) and returns the _features_ (e.g. genes, reads, variants, etc.) that
  are in that region. Examples of this in JBrowse include adapters for
  [BAM](https://samtools.github.io/hts-specs/SAMv1.pdf) and
  [VCF](https://samtools.github.io/hts-specs/VCFv4.3.pdf) file formats.
- **Regions adapter** - This type of adapter is used to define what regions are
  in an assembly. It returns a list of chromosomes/contigs/scaffolds and their
  sizes. An example of this in JBrowse is an adapter for a
  [chrome.sizes](https://software.broadinstitute.org/software/igv/chromSizes)
  file.
- **Sequence adapter** - This is basically a combination of a regions adapter
  and a feature adapter. It can give the list of regions in an assembly, and
  can also return the sequence of a queried region. Examples of this in JBrowse
  include adapters for
  [FASTA](https://blast.ncbi.nlm.nih.gov/Blast.cgi?CMD=Web&PAGE_TYPE=BlastDocs&DOC_TYPE=BlastHelp)
  and [.2bit](https://genome.ucsc.edu/FAQ/FAQformat.html#format7) file formats.
- **RefName alias adapter** - This type of adapter is used to return data about
  aliases for reference sequence names, for example to define that "chr1" is an
  alias for "1". An example of this in JBrowse is an adapter for
  (alias files)[http://software.broadinstitute.org/software/igv/LoadData/#aliasfile]
- **Text search adapter** - This type of adapter is used to search through text search indexes. Returns list of search results. An example of this in JBrowse is the trix text search adapter.

:::info Note
When using the refName alias adapter, it's important that the first column match what is seen in your FASTA file.
:::

### Skeleton of a feature adapter

A basic feature adapter might look like this (with implementation omitted for
simplicity):

```js
class MyAdapter extends BaseFeatureDataAdapter {
  constructor(config) {
    // config
  }
  async getRefNames() {
    // return refNames used in your adapter, used for refName renaming
  }

  getFeatures(region, opts) {
    // region: {
    //    refName:string, e.g. chr1
    //    start:number, 0-based half open start coord
    //    end:number, 0-based half open end coord
    //    assemblyName:string, assembly name
    //    originalRefName:string the name of the refName from the fasta file, e.g. 1 instead of chr1
    // }
    // opts: {
    //   signal?: AbortSignal
    //   ...rest: all the renderProps() object from the display type
    // }
  }

  freeResources(region) {
    // can be empty
  }
}
```

So to make a feature adapter, you implement the `getRefNames` function
(optional), the `getFeatures` function (returns an rxjs observable stream of
features, discussed below) and `freeResources` (optional).

### Example feature adapter

To take this a little slow, let's look at each function individually.

This is a more complete description of the class interface that you can implement:

```js
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { readConfObject } from '@jbrowse/core/configuration'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

class MyAdapter extends BaseFeatureDataAdapter {
  // your constructor gets a config object that you can read with readConfObject
  // if you use "subadapters" then you can initialize those with getSubAdapter
  constructor(config, getSubAdapter) {
    const fileLocation = readConfObject(config, 'fileLocation')
    const subadapter = readConfObject(config, 'sequenceAdapter')
    const sequenceAdapter = getSubAdapter(subadapter)
  }

  // use rxjs observer.next(new SimpleFeature(...your feature data....) for each
  // feature you want to return
  getFeatures(region, options) {
    return ObservableCreate(async observer => {
      try {
        const { refName, start, end } = region
        const response = await fetch(
          'http://myservice/genes/${refName}/${start}-${end}',
          options,
        )
        if (response.ok) {
          const features = await result.json()
          features.forEach(feature => {
            observer.next(
              new SimpleFeature({
                uniqueID: `${feature.refName}-${feature.start}-${feature.end}`,
                refName: feature.refName,
                start: feature.start,
                end: feature.end,
              }),
            )
          })
          observer.complete()
        } else {
          throw new Error(`${response.status} - ${response.statusText}`)
        }
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

### What is needed from a feature adapter

#### getRefNames

Returns the refNames that are contained in the file. This is
used for "refname renaming" and is optional, but highly useful in scenarios
like human chromosomes which have, for example, chr1 vs 1.

Returning the refNames used by a given file or resource allows JBrowse to
automatically smooth these small naming disparities over.
See [reference renaming](../config_guide/#configuring-reference-name-aliasing).

#### getFeatures

A function that returns features from the file given a genomic
range query e.g.,

`getFeatures(region, options)`

The region parameter contains:

```typescript
interface Region {
  refName: string
  start: number
  end: number
  originalRefName: string
  assemblyName: string
}
```

The `refName`, `start`, `end` specify a simple genomic range. The `assemblyName` is
used to query a specific assembly if your adapter responds to multiple
assemblies, e.g. for a synteny data file or a REST API that queries a backend
with multiple assemblies.

The `originalRefName` are also passed, where `originalRefName` is the queried
refname before ref renaming e.g. in BamAdapter, if the BAM file uses chr1, and
your reference genome file uses 1, then originalRefName will be 1 and refName
will be chr1.

The options parameter to getFeatures can contain any number of things:

```typescript
interface Options {
  bpPerPx: number
  signal: AbortSignal
  statusCallback: Function
  headers: Record<string, string>
}
```

- `bpPerPx` - number: resolution of the genome browser when the features were
  fetched
- `signal` - can be used to abort a fetch request when it is no longer needed,
  from AbortController
- `statusCallback` - not implemented yet but in the future may allow you to
  report the status of your loading operations
- `headers` - set of HTTP headers as a JSON object

We return an rxjs Observable from getFeatures. This is similar to a JBrowse 1
getFeatures call, where we pass each feature to a featureCallback, tell it when
we are done with finishCallback, and send errors to errorCallback, except we do
all those things with the Observable

Here is a "conversion" of JBrowse 1 getFeatures callbacks to JBrowse 2
observable calls

- `featureCallback(new SimpleFeature(...))` -> `observer.next(new SimpleFeature(...))`
- `finishCallback()` -> `observer.complete()`
- `errorCallback(error)` -> `observer.error(error)`

#### freeResources

This is uncommonly used, so most adapters make this an empty function

Most adapters in fact use an LRU cache to make resources go away over time
instead of manually cleaning up resources

## Creating custom renderers

### What is a renderer

In JBrowse 1, a track type typically would directly call the data parser and do
it's own rendering. In JBrowse 2, the data parsing and rendering is offloaded
to a web-worker or other RPC. This allows things to be faster in many cases.
This is conceptually related to "server side rendering" or SSR in React terms.

<Figure src="/img/renderer.png" caption="Conceptual diagram of how a track calls a renderer using the RPC"/>

:::warning Note
You can make custom track types that do not use this workflow, but it is a built-in workflow that functions well for the core track types in JBrowse 2, and is recommended.
:::

### How to create a new renderer

The fundamental aspect of creating a new renderer is creating a class that
implements the "render" function. A renderer is actually a pair of a React
component that contains the renderer's output, which we call the "rendering",
and the renderer itself.

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
      reactElement: React.createElement(this.ReactComponent, { ...props }),
      imageData,
      height,
      width,
    }
  }
}
```

In the above simplified example, our renderer creates a canvas using width and
height that are supplied via arguments, and draw a rectangle. We then return a
`React.createElement` call which creates a "rendering" component that will
contain the output.

:::info Note
The above canvas operations use an `OffscreenCanvas` for Chrome, or in
other browsers serialize the drawing commands to be drawn in the main thread.
:::

### What are the props passed to the renderer

The typical props that a renderer receives:

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
things in pileup format, and has an addRect function to get the y-coordinate at which to
render your data.

The features argument is a map of feature ID to the feature itself. To iterate
over the features Map, we can use an iterator or convert to an array:

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

Track models themselves can extend this using their `renderProps` function.

For example, the `WiggleTrack` has code similar to this, which adds a scaleOpts
prop that gets passed to the renderer:

```js
const model = types
  .compose(
    'WiggleTrack',
    blockBasedTrack,
    types.model({
      type: types.literal('WiggleTrack'),
    }),
  )
  .views(self => {
    const { renderProps: superRenderProps } = self
    return {
      renderProps() {
        return {
          ...superRenderProps(),
          scaleOpts: {
            domain: this.domain,
            stats: self.stats,
            autoscaleType: getConf(self, 'autoscale'),
            scaleType: getConf(self, 'scaleType'),
            inverted: getConf(self, 'inverted'),
          },
        }
      },
    }
  })
```

### Rendering SVG

Our SVG renderer is an example, where it extends the existing built in renderer
type with a custom ReactComponent only:

```js
export default class SVGPlugin extends Plugin {
  install(pluginManager: PluginManager) {
    pluginManager.addRendererType(
      () =>
        new BoxRendererType({
          name: 'SvgFeatureRenderer',
          ReactComponent: SvgFeatureRendererReactComponent,
          configSchema: svgFeatureRendererConfigSchema,
          pluginManager,
        }),
    )
  }
}
```

Then, we have our Rendering component just be plain React code. This is a
highly simplified SVG renderer just to illustrate:

```jsx
export default function SvgFeatureRendering(props) {
  const { width, features, regions, layout, bpPerPx } = props
  const region = regions[0]

  const feats = Array.from(features.values())
  const height = readConfObject(config, 'height', { feature })
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

:::info Note

1.The above SVG renderer is highly simplified, but it
shows that you can have a simple React component that leverages the existing
`BoxRendererType`, so that you do not have to necessarily create your own
renderer class

2.The renderers receive an array of regions to render, but if they are only
equipped to handle one region at a time then they can select only rendering
to `regions[0]`
:::

### Overriding the renderer's getFeatures method

Normally, it is sufficient to override the `getFeatures` function in your
dataAdapter.

If you want to drastically modify the feature fetching behavior, you can modify
the renderer's `getFeatures` call.

The base `ServerSideRendererType` class has a built-in `getFeatures` function that,
in turn, calls your adapter's `getFeatures` function, but if you need
tighter control over how your adapter's `getFeatures` method is called, then
your renderer.

The Hi-C renderer type does not operate on conventional
features and instead works with contact matrices, so the Hi-C renderer has a
custom `getFeatures` function:

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

At a high level, the track types are just "ReactComponents" that contain
rendered track contents. Oftentimes, for custom drawing, we create a renderer
instead of a track, but here are some reasons you might want a custom track:

- Drawing custom things over the rendered content (e.g. drawing the Y-scale bar
  in the wiggle track)
- Implementing custom track menu items (e.g. Show soft clipping in the
  alignments track)
- Adding custom widgets (e.g. custom `VariantFeatureWidget` in
  variant track)
- You want to bundle your renderer and adapter as a specific thing that is
  automatically initialized rather than the `BasicTrack` (which combines any
  adapter and renderer)

For examples of custom track types, refer to things like:

- `HicTrack`, which uses a custom HicRenderer to draw contact matrix
- `GDCPlugin`, which has a custom track type that registers custom feature detail
  widgets
- `VariantTrack`, which also registers custom widgets, and has
  `ChordVariantDisplay` and `LinearVariantDisplay`
- `SyntenyTrack`, which can be displayed with `DotplotDisplay` or
  `LinearSyntenyDisplay`
