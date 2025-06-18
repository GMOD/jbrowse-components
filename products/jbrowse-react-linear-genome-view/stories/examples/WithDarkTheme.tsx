// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view2'
import { getVolvoxConfig } from './util'
import { JBrowseLinearGenomeView, createViewState } from '../../src'

export const WithDarkTheme = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const state = createViewState({
    assembly,
    tracks,
    configuration: {
      theme: {
        palette: {
          mode: 'dark',
          primary: {
            main: '#333',
          },
          secondary: {
            main: '#444',
          },
        },
      },
    },
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithDarkTheme.tsx">
        Source code
      </a>
    </div>
  )
}
