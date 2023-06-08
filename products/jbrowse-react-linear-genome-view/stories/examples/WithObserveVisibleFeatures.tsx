import React, { useState, useEffect } from 'react'
import { Feature } from '@jbrowse/core/util'
import { getConf } from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import RpcManager from '@jbrowse/core/rpc/RpcManager'

// in your code
// import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view'
import { createViewState, JBrowseLinearGenomeView } from '../../src'
import { getVolvoxConfig } from './util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

// specifically coded to fetch from the first track (view.tracks[0])
const VisibleFeatures = observer(function ({
  session,
}: {
  session: { rpcManager: RpcManager; view: LinearGenomeViewModel }
}) {
  const [features, setFeatures] = useState<Feature[]>()
  const { rpcManager, view } = session

  // "coarseDynamicBlocks" is the currently visible regions, with a little
  // debounce so that it doesn't update too fast
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      if (!view.initialized) {
        return
      }
      const track = view.tracks[0]
      const adapterConfig = getConf(track, 'adapter')
      const sessionId = getRpcSessionId(track)
      const feats = await rpcManager.call(sessionId, 'CoreGetFeatures', {
        adapterConfig,
        sessionId,
        regions: view.coarseDynamicBlocks,
      })
      setFeatures(feats as Feature[])
    })()
  }, [rpcManager, view.initialized, view.coarseDynamicBlocks, view.tracks])
  return (
    <div>
      {!features ? (
        <div>Loading...</div>
      ) : (
        <div>
          <h4>Visible features in {view.coarseVisibleLocStrings}:</h4>
          <table>
            <thead>
              <tr>
                <th>Feature name</th>
                <th>Feature location</th>
              </tr>
            </thead>
            {features.map(f => (
              <tr key={f.id()}>
                <td>{f.get('name')}</td>
                <td>
                  {f.get('refName')}:{f.get('start')}-{f.get('end')}
                </td>
              </tr>
            ))}
          </table>
        </div>
      )}
    </div>
  )
})

export const WithObserveVisibleFeatures = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const state = createViewState({
    assembly,
    tracks,
    location: 'ctgA:1105..1221',
  })
  state.session.view.showTrack('volvox_cram')
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <VisibleFeatures session={state.session} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithObserveVisibleFeatures.tsx">
        Source code
      </a>
    </div>
  )
}
