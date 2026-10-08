import { JBrowse } from '@jbrowse/react-app2'
import RpcWorker from '@jbrowse/react-app2/esm/rpcWorker?worker'

const assemblies = [
  { name: 'volvox', uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
]

const tracks = [
  {
    trackId: 'volvox_gff3',
    name: 'Volvox genes',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
  },
]

export default function WebWorker() {
  return (
    <JBrowse
      assemblies={assemblies}
      tracks={tracks}
      makeWorkerInstance={() => new RpcWorker()}
      views={[
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1..50000',
          tracks: ['volvox_gff3'],
        },
      ]}
    />
  )
}
