import { useEffect, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { assembleLocString } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import type { Feature } from '@jbrowse/core/util'
import type { ViewModel } from '@jbrowse/react-linear-genome-view2'

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

const VisibleFeatures = observer(function VisibleFeatures({
  viewState,
}: {
  viewState: ViewModel
}) {
  const [features, setFeatures] = useState<Feature[]>()
  const [error, setError] = useState<unknown>()
  const { rpcManager, view } = viewState.session

  useEffect(() => {
    let latest = 0
    return autorun(() => {
      if (view.initialized) {
        const track = view.tracks[0]
        if (track) {
          const adapterConfig = getConf(track, 'adapter')
          const sessionId = getRpcSessionId(track)
          const generation = ++latest
          void rpcManager
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
              {assembleLocString({
                refName: f.get('refName'),
                start: f.get('start'),
                end: f.get('end'),
              })}
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
  return state ? (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <VisibleRegions viewState={state} />
      <VisibleFeatures viewState={state} />
    </div>
  ) : null
}
