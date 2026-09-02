import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'
// Vite/Astro apps construct the RPC worker with Vite's `?worker` suffix. (With
// a webpack/CRA setup you'd instead import the package's prebuilt
// `@jbrowse/react-linear-genome-view2/esm/makeWorkerInstance`.)
import RpcWorker from '@jbrowse/react-linear-genome-view2/esm/rpcWorker?worker'

export default function WithWebWorker() {
  const state = useCreateViewState({
    assembly: {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
    tracks: [
      {
        trackId: 'volvox_gff3',
        name: 'Volvox genes',
        uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
      },
    ],
    init: { loc: 'ctgA:1105..1221', tracks: ['volvox_gff3'] },
    // supplying makeWorkerInstance is enough — the RPC default driver
    // switches to WebWorkerRpcDriver automatically (no defaultDriver config
    // needed)
    makeWorkerInstance: () => new RpcWorker(),
  })
  return state ? <JBrowseLinearGenomeView viewState={state} /> : null
}
