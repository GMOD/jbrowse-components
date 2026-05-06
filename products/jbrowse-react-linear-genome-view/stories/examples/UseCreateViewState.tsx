// in your code:
// import { useCreateViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'
import { useState } from 'react'

import { getVolvoxConfig } from './util.ts'
import { JBrowseLinearGenomeView, useCreateViewState } from '../../src/index.ts'

// This component renders the genome view. Because it uses useCreateViewState,
// parent re-renders (e.g. from the counter above) do not reset the browser.
function GenomeView() {
  const { assembly, tracks } = getVolvoxConfig()
  const state = useCreateViewState({
    assembly,
    tracks,
    location: 'ctgA:1105..1221',
  })
  return <JBrowseLinearGenomeView viewState={state} />
}

export const UseCreateViewState = () => {
  const [count, setCount] = useState(0)
  return (
    <div>
      <p>
        Parent render count: {count} — clicking the button triggers a parent
        re-render, but the genome view state is preserved because{' '}
        <code>useCreateViewState</code> creates the state only once.
      </p>
      <button
        onClick={() => {
          setCount(c => c + 1)
        }}
      >
        Re-render parent
      </button>
      <GenomeView />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/UseCreateViewState.tsx">
        Source code
      </a>
    </div>
  )
}
