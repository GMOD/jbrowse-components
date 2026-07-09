import { useEffect, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { Feature } from '@jbrowse/core/util'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const assembly = {
  name: 'volvox',
  sequence: {
    adapter: {
      type: 'TwoBitAdapter',
      twoBitLocation: { uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
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
      gffGzLocation: {
        uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
      },
      index: {
        location: {
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz.tbi',
        },
      },
    },
  },
]

function loc(r: BaseBlock) {
  return r.type === 'ContentBlock'
    ? `${r.refName}:${Math.floor(r.start)}-${Math.floor(r.end)}`
    : ''
}

type ViewState = ReturnType<typeof useCreateViewState>

// reading the visible regions is synchronous observable state
const VisibleRegions = observer(function VisibleRegions({
  viewState,
}: {
  viewState: ViewState
}) {
  const view = viewState.session.view
  return view.initialized ? (
    <p>
      Visible region{' '}
      {view.coarseDynamicBlocks.map(loc).filter(Boolean).join(',')}
    </p>
  ) : null
})

// reading actual feature data needs an RPC round-trip, keyed off the debounced
// coarseDynamicBlocks so a drag doesn't fire a fetch per frame
const VisibleFeatures = observer(function VisibleFeatures({
  session,
}: {
  session: { rpcManager: RpcManager; view: LinearGenomeViewModel }
}) {
  const [features, setFeatures] = useState<Feature[]>()
  const [error, setError] = useState<unknown>()
  const { rpcManager, view } = session

  useEffect(() => {
    return autorun(() => {
      if (view.initialized) {
        const track = view.tracks[0]
        if (track) {
          const adapterConfig = getConf(track, 'adapter')
          const sessionId = getRpcSessionId(track)
          void rpcManager
            .call(sessionId, 'CoreGetFeatures', {
              adapterConfig,
              regions: view.coarseDynamicBlocks,
            })
            .then(feats => {
              setFeatures(feats)
            })
            .catch((e: unknown) => {
              setError(e)
            })
        }
      }
    })
  }, [rpcManager, view])

  return error ? (
    <div>Error: {String(error)}</div>
  ) : !features ? (
    <div>Loading...</div>
  ) : (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Location</th>
        </tr>
      </thead>
      <tbody>
        {features.map(f => (
          <tr key={f.id()}>
            <td>{f.get('name')}</td>
            <td>
              {f.get('refName')}:{f.get('start')}-{f.get('end')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
})

export default function App() {
  const state = useCreateViewState({
    assembly,
    tracks,
    location: 'ctgA:1105..1221',
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <VisibleRegions viewState={state} />
      <VisibleFeatures session={state.session} />
    </div>
  )
}
