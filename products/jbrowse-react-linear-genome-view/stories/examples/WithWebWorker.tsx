// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view2'
import { getVolvoxConfig } from './util.ts'
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'
// in your code
// import {makeWorkerInstance} from '@jbrowse/react-linear-genome-view2/esm/makeWorkerInstance'
import makeWorkerInstance from '../../src/makeWorkerInstance.ts'

export const WithWebWorker = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const state = createViewState({
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
  state.session.view.showTrack('Deep sequencing')

  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithWebWorker.tsx">
        Source code
      </a>
    </div>
  )
}
