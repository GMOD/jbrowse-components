import { useEffect, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { assembleLocString, isFeature } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import type { Feature } from '@jbrowse/core/util'
import type { ViewModel } from '@jbrowse/react-linear-genome-view2'

function locOf(f: Feature) {
  return assembleLocString({
    refName: f.get('refName'),
    start: f.get('start'),
    end: f.get('end'),
  })
}

const SelectedFeature = observer(function SelectedFeature({
  viewState,
}: {
  viewState: ViewModel
}) {
  const { selection } = viewState.session
  return isFeature(selection) ? (
    <p>
      Selected <b>{selection.get('name') || selection.id()}</b> at{' '}
      {locOf(selection)}
    </p>
  ) : (
    <p>Click a feature to select it.</p>
  )
})

const VisibleFeatures = observer(function VisibleFeatures({
  viewState,
}: {
  viewState: ViewModel
}) {
  const [result, setResult] = useState<
    { features: Feature[] } | { error: unknown }
  >()
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
            .then(features => {
              if (generation === latest) {
                setResult({ features })
              }
            })
            .catch((error: unknown) => {
              if (generation === latest) {
                setResult({ error })
              }
            })
        }
      }
    })
  }, [rpcManager, view])

  return view.initialized ? (
    <div>
      <p>Visible region {view.coarseVisibleLocStrings}</p>
      {!result ? (
        <div>Loading...</div>
      ) : 'error' in result ? (
        <div>Error: {String(result.error)}</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {result.features.map(f => (
              <tr key={f.id()}>
                <td>{f.get('name')}</td>
                <td>{locOf(f)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  ) : null
})

export default function ObserveSession() {
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
  })
  return state ? (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <SelectedFeature viewState={state} />
      <VisibleFeatures viewState={state} />
    </div>
  ) : null
}
