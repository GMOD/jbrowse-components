import { observer } from 'mobx-react'

// in your code
// import { useCreateViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'
import { getVolvoxConfig } from './util.ts'
import { JBrowseLinearGenomeView, useCreateViewState } from '../../src/index.ts'

import type { Region } from '@jbrowse/core/util'

function loc(r: Region) {
  return `${r.refName}:${Math.floor(r.start)}-${Math.floor(r.end)}`
}

type ViewState = ReturnType<typeof useCreateViewState>

const VisibleRegions = observer(function VisibleRegions({
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
  const state = useCreateViewState({
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
