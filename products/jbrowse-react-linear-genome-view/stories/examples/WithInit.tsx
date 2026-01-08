// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view2'
import { getVolvoxConfig } from './util.ts'
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

export const WithInit = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const state = createViewState({
    assembly,
    tracks,
    defaultSession: {
      name: 'Hello',
      view: {
        type: 'LinearGenomeView',
        init: {
          loc: 'ctgA:10000-20000',
          assembly: 'volvox',
          tracks: ['volvox_test_vcf'],
        },
      },
    },
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithInit.tsx">
        Source code
      </a>
    </div>
  )
}
