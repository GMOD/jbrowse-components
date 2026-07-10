import { useState } from 'react'

import {
  JBrowseLinearGenomeView,
  createViewState,
} from '@jbrowse/react-linear-genome-view2'
// Vite/Astro apps construct the RPC worker with Vite's `?worker` suffix. (With
// a webpack/CRA setup you'd instead import the package's prebuilt
// `@jbrowse/react-linear-genome-view2/esm/makeWorkerInstance`.)
import RpcWorker from '@jbrowse/react-linear-genome-view2/esm/rpcWorker?worker'

const assembly = {
  name: 'volvox',
  sequence: {
    adapter: {
      type: 'TwoBitAdapter',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
  },
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'volvox_gff3',
    name: 'Volvox genes',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'Gff3TabixAdapter',
      uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
    },
  },
]

export default function WithWebWorker() {
  const [state] = useState(() => {
    const s = createViewState({
      assembly,
      tracks,
      location: 'ctgA:1105..1221',
      // supplying makeWorkerInstance is enough — the RPC default driver
      // switches to WebWorkerRpcDriver automatically (no defaultDriver config
      // needed)
      makeWorkerInstance: () => new RpcWorker(),
    })
    s.session.view.showTrack('volvox_gff3')
    return s
  })
  return <JBrowseLinearGenomeView viewState={state} />
}
