import React from 'react'
import { createViewState, JBrowseWebApp } from '@jbrowse/react-app'

import assembly from './assembly'
import tracks from './tracks'

export default function App() {
  const state = createViewState({
    assemblies: [assembly],
    tracks,
    location: 'ctgA:1105..1221',
  })

  return <JBrowseWebApp viewState={state} />
}
