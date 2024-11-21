import React from 'react'
import { Region } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

// in your code
// import { createViewState, loadPlugins, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view'
import { createViewState, JBrowseLinearGenomeView } from '../../src'
import { getVolvoxConfig } from './util'

function loc(r: Region) {
  return `${r.refName}:${Math.floor(r.start)}-${Math.floor(r.end)}`
}

type ViewState = ReturnType<typeof createViewState>

const VisibleRegions = observer(function ({
  viewState,
}: {
  viewState: ViewState
}) {
  const view = viewState.session.views[0]!
  return view.initialized ? (
    <div>
      <p>Visible region {view.coarseDynamicBlocks.map(loc).join(',')}</p>
      <p>Static blocks {view.staticBlocks.map(loc).join(',')}</p>
    </div>
  ) : null
})

export const WithObserveVisibleRegions = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const state = createViewState({
    assembly,
    tracks,
    location: 'ctgA:1105..1221',
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <VisibleRegions viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithObserveVisibleRegions.tsx">
        Source code
      </a>
    </div>
  )
}
