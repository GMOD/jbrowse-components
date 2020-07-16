---
id: developer_creating_plugin
title: Creating a new plugin
---

JBrowse 2 plugins can be used to add track types, view types, data adapter. For
a full list, see the [pluggable
elements](/jb2/docs/developer_pluggable_elements) page. The plugins can also
extend logic in many arbitary ways beyond even adding these elements too.

We will go over creating an example plugin. The first thing that we have is a
`src/index.js` which exports a default class containing the plugin registration
code

src/index.js

```js
import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import Plugin from '@gmod/jbrowse-core/Plugin'
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
} from '@gmod/jbrowse-core/configuration'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { BaseFeatureDataAdapter } from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'
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
track=geneHancerInteractionsDoubleElite;chrom=chr1;start=750000;end=505700000'|less
```

Given that the functionality of rendering arcs is so distinct from UCSC API
adaptation, we can actually make this a new plugin. Let's imagine starting a
new plugin from scratch again

src/index.js

```js
import Plugin from '@gmod/jbrowse-core/Plugin'
import PluginManager from '@gmod/jbrowse-core/PluginManager'

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
} from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType'
import {
  ConfigurationSchema,
  readConfObject,
} from '@gmod/jbrowse-core/configuration'

import { PrerenderedCanvas } from '@gmod/jbrowse-core/ui'
import { bpSpanPx } from '@gmod/jbrowse-core/util'
import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'

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
