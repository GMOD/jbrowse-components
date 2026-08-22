import { useEffect, useState } from 'react'

import {
  JBrowseCircularGenomeView,
  createViewState,
} from '@jbrowse/react-circular-genome-view2'

import assembly from './assembly'
import tracks from './tracks'

export default function View() {
  const [viewState, setViewState] =
    useState<Awaited<ReturnType<typeof createViewState>>>()

  useEffect(() => {
    void createViewState({
      assembly,
      tracks,
    }).then(state => {
      state.session.view.showTrack('volvox_sv_test_renamed')
      setViewState(state)
    })
  }, [])

  if (!viewState) {
    return null
  }

  return <JBrowseCircularGenomeView viewState={viewState} />
}
