import { observer } from 'mobx-react'

// in your code
// import { useCreateViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'
import { getVolvoxConfig } from './util.tsx'
import { JBrowseLinearGenomeView, useCreateViewState } from '../../src/index.ts'

import type { BaseBlock } from '@jbrowse/core/util/blockTypes'

function loc(r: BaseBlock) {
  return r.type === 'ContentBlock'
    ? `${r.refName}:${Math.floor(r.start)}-${Math.floor(r.end)}`
    : ''
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
      <p>Static blocks {view.staticBlocks.contentBlocks.map(loc).join(',')}</p>
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
