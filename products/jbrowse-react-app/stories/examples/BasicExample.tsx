import React from 'react'

// locals
import { createViewState, JBrowseWebApp } from '../../src'
import makeWorkerInstance from '../../src/makeWorkerInstance'
import volvoxConfig from '../../public/test_data/volvox/config.json'
import { addRelativeUris } from '../util'

const configPath = 'test_data/volvox/config.json'
addRelativeUris(volvoxConfig, new URL(configPath, window.location.href).href)

const assemblies = volvoxConfig.assemblies
const tracks = volvoxConfig.tracks

export const BasicExample = () => {
  const state = createViewState({
    assemblies,
    tracks,
    location: 'ctgA:1105..1221',
    configuration: {
      rpc: {
        defaultDriver: 'WebWorkerRpcDriver',
      },
    },
    makeWorkerInstance,
  })
  state.session.views[0]?.showTrack('Deep sequencing')

  return <JBrowseWebApp viewState={state} />
}
