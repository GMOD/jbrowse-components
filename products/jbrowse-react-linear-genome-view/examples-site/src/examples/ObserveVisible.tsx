import { useEffect, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import type { Feature } from '@jbrowse/core/util'
import type { ViewModel } from '@jbrowse/react-linear-genome-view2'

// reading the visible regions is synchronous observable state.
// coarseVisibleLocStrings is the debounced twin of visibleLocStrings, and it
// already assembles the locstring for you — including the [rev] marker on a
// flipped region and the assembly prefix when several are on screen
const VisibleRegions = observer(function VisibleRegions({
  viewState,
}: {
  viewState: ViewModel
}) {
  const view = viewState.session.view
  return view.initialized ? (
    <p>Visible region {view.coarseVisibleLocStrings}</p>
  ) : null
})

// reading actual feature data needs an RPC round-trip, keyed off the debounced
// coarseDynamicBlocks so a drag doesn't fire a fetch per frame
const VisibleFeatures = observer(function VisibleFeatures({
  viewState,
}: {
  viewState: ViewModel
}) {
  const [features, setFeatures] = useState<Feature[]>()
  const [error, setError] = useState<unknown>()
  const { rpcManager, view } = viewState.session

  useEffect(() => {
    // each run supersedes the one before it. Two pans in quick succession leave
    // two calls in flight, and they can come back in either order — without the
    // generation check the slower, older one lands last and the table shows the
    // region you already left
    let latest = 0
    return autorun(() => {
      if (view.initialized) {
        const track = view.tracks[0]
        if (track) {
          const adapterConfig = getConf(track, 'adapter')
          const sessionId = getRpcSessionId(track)
          const generation = ++latest
          void rpcManager
            // No handles here on purpose: this page's whole subject is the
            // generation check below, and the source is published verbatim as a
            // `?raw` block, so a stop token and a status sink would be two more
            // mechanisms to read past before reaching the one it teaches. A real
            // display gets both off `ctx` — see FetchMixin.
            // eslint-disable-next-line no-restricted-syntax
            .call(sessionId, 'CoreGetFeatures', {
              adapterConfig,
              regions: view.coarseDynamicBlocks,
            })
            .then(feats => {
              if (generation === latest) {
                setFeatures(feats)
              }
            })
            .catch((e: unknown) => {
              if (generation === latest) {
                setError(e)
              }
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

export default function ObserveVisible() {
  const state = useCreateViewState({
    assembly: {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
    tracks: [
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
    ],
    // open the track (via a default session) so it appears in view.tracks — the
    // feature table below reads its adapter to fetch the visible features
    defaultSession: {
      name: 'Observe visible',
      view: {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: 'ctgA:1105..1221',
        tracks: ['volvox_gff3'],
      },
    },
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <VisibleRegions viewState={state} />
      <VisibleFeatures viewState={state} />
    </div>
  )
}
