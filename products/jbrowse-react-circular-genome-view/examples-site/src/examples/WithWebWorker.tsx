import {
  JBrowseCircularGenomeView,
  useCreateViewState,
} from '@jbrowse/react-circular-genome-view2'
import RpcWorker from '@jbrowse/react-circular-genome-view2/esm/rpcWorker?worker'

export default function WithWebWorker() {
  const state = useCreateViewState({
    assembly: {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
    tracks: [
      {
        trackId: 'volvox_sv',
        name: 'Volvox duplications',
        uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.dup.vcf.gz',
      },
    ],
    view: { tracks: ['volvox_sv'] },
    makeWorkerInstance: () => new RpcWorker(),
  })
  return state ? <JBrowseCircularGenomeView viewState={state} /> : null
}
