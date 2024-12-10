import React, { useState, useEffect } from 'react'
import {
  createViewState,
  JBrowseCircularGenomeView,
} from '@jbrowse/react-circular-genome-view'

import assembly from './assembly'
import tracks from './tracks'

export default function View() {
  const [viewState, setViewState] =
    useState<ReturnType<typeof createViewState>>()

  useEffect(() => {
    const state = createViewState({
      assembly,
      tracks,
    })
    state.session.view.showTrack('volvox_sv_test_renamed')
    setViewState(state)
  }, [])

  if (!viewState) {
    return null
  }

  return <JBrowseCircularGenomeView viewState={viewState} />
}
