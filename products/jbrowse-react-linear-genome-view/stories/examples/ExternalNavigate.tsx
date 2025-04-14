// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view2'
import { getVolvoxConfig } from './util'
import { JBrowseLinearGenomeView, createViewState } from '../../src'

export const ExternalNavigate = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const state = createViewState({
    assembly,
    tracks,
    disableAddTracks: true,
  })
  const options = [
    { name: 'EDEN', location: 'ctgA:1-5000' },
    { name: 'Apple1', location: 'ctgA:1-5000' },
  ]
  return (
    <div>
      <select value={val} onChange={event => setVal(event.target.value)}>
        {options.map(o => (
          <option key={o.name} value={o.name}>
            {o.name}
          </option>
        ))}
      </select>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/ExternalNavigate.tsx">
        Source code
      </a>
    </div>
  )
}
