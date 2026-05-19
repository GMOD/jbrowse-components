// in your code:
// import { useCreateViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'
import { getVolvoxConfig } from './util.ts'
import { JBrowseLinearGenomeView, useCreateViewState } from '../../src/index.ts'

export const DisableAddTrack = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const state = useCreateViewState({
    assembly,
    tracks,
    disableAddTracks: true,
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/DisableAddTrack.tsx">
        Source code
      </a>
    </div>
  )
}
