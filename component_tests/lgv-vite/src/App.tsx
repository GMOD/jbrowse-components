import { useEffect, useState } from 'react'

import {
  JBrowseLinearGenomeView,
  createViewState,
} from '@jbrowse/react-linear-genome-view2'

import assembly from './assembly'
import tracks from './tracks'

type ViewModel = ReturnType<typeof createViewState>

export default function View() {
  const [viewState, setViewState] = useState<ViewModel>()

  useEffect(() => {
    const state = createViewState({
      assembly,
      tracks,
      location: 'ctgA:1-100',
    })
    state.session.view.showTrack('volvox_cram')
    setViewState(state)
  }, [])

  if (!viewState) {
    return null
  }

  return <JBrowseLinearGenomeView viewState={viewState} />
}
