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
import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { ObservableCreate } from '@gmod/jbrowse-core/util/rxjs'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import stringify from 'json-stable-stringify'

export const configSchema = ConfigurationSchema(
  'UCSCAdapter',
  {
    baseUrl: {
      type: 'fileLocation',
      description: 'base URL for the UCSC API',
      defaultValue: { uri: 'https://api.genome.ucsc.edu/' },
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

  getFeatures(region, options) {
    const { assemblyName, start, end, refName } = region

    return new ObservableCreate(async observer => {
      const base = readConfObject(this.config, 'baseUrl')
      const track = readConfObject(this.config, 'track')
      try {
        const result = await fetch(
          `${base}/getData/track?` +
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
}
```

The above is a large block of code, but I hope it has not too much
complication. See the page on [creating a data
adapter](developer_creating_data_adapter) for more details the code.

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
import { ArcRenderer, ReactComponent, configSchema } from './ArcRenderer'

export default class UCSCPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addRendererType(
      () =>
        new ArcRenderer({
          name: 'ArcRenderer',
          configSchema,
          AdapterClass,
        }),
    )
  }
}
```

src/ArcRenderer/index.js

```js
// prettier-ignore
import ServerSideRendererType
    from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType'

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

// This ReactComponent the so called "rendering" which is the component
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
export class ArcRenderer extends ServerSideRendererType {
  async render(renderProps) {
    const { width, features, config, regions } = renderProps
    const height = 500
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')
    const region = regions[0]
    for (const feature of features.values) {
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
      ctx.bezierCurveTo(left, height / 2, right, height / 2, right, 0)
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
