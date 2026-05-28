// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view2'
import { useState } from 'react'

import { getVolvoxConfig } from './util.tsx'
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'
// in your code
// import {makeWorkerInstance} from '@jbrowse/react-linear-genome-view2/esm/makeWorkerInstance'
import makeWorkerInstance from '../../src/makeWorkerInstance.ts'

export const WithWebWorker = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const [state] = useState(() => {
    const s = createViewState({
      assembly,
      tracks,
      location: 'ctgA:1105..1221',
      configuration: {
        rpc: {
          defaultDriver: 'WebWorkerRpcDriver',
        },
      },
      makeWorkerInstance,
    })
    s.session.view.showTrack('Deep sequencing')
    return s
  })

  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithWebWorker.tsx">
        Source code
      </a>
    </div>
  )
}
