import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'
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
    view: { loc: 'ctgA:1105..1221', tracks: ['volvox_gff3'] },
    makeWorkerInstance: () => new RpcWorker(),
  })
  return state ? <JBrowseLinearGenomeView viewState={state} /> : null
}
