import React from 'react'
// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view'
import { createViewState, JBrowseLinearGenomeView } from '../../src'
import makeWorkerInstance from '../../src/makeWorkerInstance'
import { getVolvoxConfig } from './util'
import { createRoot, hydrateRoot } from 'react-dom/client'

export const WithReact18 = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const state = createViewState({
    assembly,
    tracks,
    configuration: {
      rpc: {
        defaultDriver: 'WebWorkerRpcDriver',
      },
    },
    makeWorkerInstance,

    hydrateFn: hydrateRoot,
    createRootFn: createRoot,
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithReact18.tsx">
        Source code
      </a>
    </div>
  )
}
