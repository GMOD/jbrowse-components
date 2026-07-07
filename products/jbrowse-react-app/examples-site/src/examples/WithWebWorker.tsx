import { JBrowse } from '@jbrowse/react-app2'
// Vite/Astro apps construct the RPC worker with Vite's `?worker` suffix. (With
// a webpack/CRA setup you'd instead import the package's prebuilt
// `@jbrowse/react-app2/esm/makeWorkerInstance`.)
import RpcWorker from '@jbrowse/react-app2/esm/rpcWorker?worker'

const assemblies = [
  {
    name: 'volvox',
    sequence: {
      adapter: {
        type: 'TwoBitAdapter',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
      },
    },
    refNameAliases: {
      adapter: {
        type: 'FromConfigAdapter',
        adapterId: 'W6DyPGJ0UU',
        features: [
          { refName: 'ctgA', uniqueId: 'alias1', aliases: ['A'] },
          { refName: 'ctgB', uniqueId: 'alias2', aliases: ['B'] },
        ],
      },
    },
  },
]

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
  return (
    <JBrowse
      assemblies={assemblies}
      tracks={tracks}
      configuration={{ rpc: { defaultDriver: 'WebWorkerRpcDriver' } }}
      makeWorkerInstance={() => new RpcWorker()}
      views={[
        {
          type: 'LinearGenomeView',
          init: {
            assembly: 'volvox',
            loc: 'ctgA:1..50000',
            tracks: ['volvox_gff3'],
          },
        },
      ]}
    />
  )
}
