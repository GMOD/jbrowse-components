// replace with this in your code:
// import {createViewState,JBrowseApp} from '@jbrowse/react-app2'
import volvoxConfig from '../../public/test_data/volvox/config.json' with { type: 'json' }
import { JBrowseApp, createViewState } from '../../src/index.ts'
// replace with this in your code:
// import makeWorkerInstance from '@jbrowse/react-app2/esm/makeWorkerInstance'
import makeWorkerInstance from '../../src/makeWorkerInstance.ts'

export const WithWebWorker = () => {
  const state = createViewState({
    config: {
      ...volvoxConfig,
      configuration: {
        rpc: {
          defaultDriver: 'WebWorkerRpcDriver',
        },
      },
      defaultSession: {
        name: 'Web worker example',
        views: [
          {
            type: 'LinearGenomeView',
            init: {
              assembly: 'volvox',
              loc: 'ctgA:1000-2000',
              tracks: ['Deep sequencing'],
            },
          },
        ],
      },
    },
    makeWorkerInstance,
  })

  return (
    <div>
      <JBrowseApp viewState={state} />
    </div>
  )
}
