# @jbrowse/embedded-linear-genome-view

A framework-agnostic **imperative mount API** for the JBrowse 2 linear genome
view. It wraps `@jbrowse/react-linear-genome-view2` and hides React behind a
small controller, so any non-React host — [anywidget][] (Python/Jupyter),
[htmlwidgets][] (R/Shiny), vanilla JS, Observable, Svelte/Vue — drives the same
engine through the same object.

Events flow **out** through callbacks; mutations flow **in** through methods; the
controller owns the whole lifecycle (async assembly resolution, rebuilds,
teardown).

```js
import { createLinearGenomeView } from '@jbrowse/embedded-linear-genome-view'

const view = createLinearGenomeView(document.getElementById('root'), {
  assembly: 'hg38', // hub name, hub config, or a bare assembly config
  location: 'BRCA1',
  tracks: [
    {
      type: 'FeatureTrack',
      trackId: 'genes',
      name: 'Genes',
      assemblyNames: ['hg38'],
      adapter: { type: 'Gff3TabixAdapter', uri: '.../genes.gff.gz' },
    },
  ],
  onLocationChange: loc => console.log('now viewing', loc),
  onFeatureSelect: feature => console.log('clicked', feature),
})
```

## Assembly, three shapes

`assembly` accepts, and the controller resolves:

- **a hub name** — `'hg38'`, `'mm10'`, or a GenArk accession `'GCF_000001405.40'`.
  Fetched from jbrowse.org; its refName aliases, cytobands, and text-search
  adapters come along for free.
- **a full hub config** — what `fetchHub('hg38')` returns; the first assembly is
  used and its search adapters are wired in.
- **a bare assembly config** — hand-written, or from `makeAssembly(...)`.

```js
import { fetchHub, makeAssembly } from '@jbrowse/embedded-linear-genome-view'

const custom = makeAssembly({ name: 'volvox', fastaUri: '.../volvox.fa.gz' })
```

## Controller

| method | effect |
| --- | --- |
| `setLocation(loc)` | navigate (region string or gene name); returns a promise |
| `setAssembly(a)` | swap the genome — rebuilds the engine |
| `setSession(s)` | load/clear a serialized session — rebuilds the engine |
| `setTracks(list)` | open exactly `list`, closing anything else |
| `addTrack(conf)` / `removeTrack(id)` | open/close one track |
| `destroy()` | dispose reactions and unmount |
| `whenReady()` | promise of the underlying MST model once (re)built |
| `viewState` | the MST model, or `undefined` until the first build resolves |

Building is async (a hub name is fetched first). Methods called before the build
settles are captured and applied when it does, so ordering never matters.

[anywidget]: https://anywidget.dev
[htmlwidgets]: https://www.htmlwidgets.org
