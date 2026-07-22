import { useEffect, useState } from 'react'

import ScoreExamplePlugin from '@jbrowse/plugin-score-example'
import {
  JBrowseLinearGenomeView,
  createViewState,
} from '@jbrowse/react-linear-genome-view2'

import { assembly, tracks } from './config'

type ViewModel = ReturnType<typeof createViewState>

export default function View() {
  const [viewState, setViewState] = useState<ViewModel>()

  useEffect(() => {
    const state = createViewState({
      assembly,
      tracks,
      plugins: [ScoreExamplePlugin],
      location: 'ctgA:1-1000',
    })
    state.session.view.showTrack('volvox_scores')
    setViewState(state)
  }, [])

  if (!viewState) {
    return null
  }

  return <JBrowseLinearGenomeView viewState={viewState} />
}
