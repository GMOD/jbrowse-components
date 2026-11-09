import { CircularGenomeView } from '@jbrowse/react-circular-genome-view2'
import RpcWorker from '@jbrowse/react-circular-genome-view2/esm/rpcWorker?worker'

const assembly = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
}

const tracks = [
  {
    trackId: 'volvox_sv',
    name: 'Volvox duplications',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.dup.vcf.gz',
  },
]

export default function WebWorker() {
  return (
    <CircularGenomeView
      assembly={assembly}
      tracks={tracks}
      view={{ tracks: ['volvox_sv'] }}
      makeWorkerInstance={() => new RpcWorker()}
    />
  )
}
