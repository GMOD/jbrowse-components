// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view2'
import { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'

import { getVolvoxConfig } from './util.ts'
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

type ViewState = ReturnType<typeof createViewState>

// Example 1: Pass [rev] in a locstring to navToLocString
export const HorizontallyFlippedViaLocstring = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      location: 'ctgA:1-50000[rev]',
    }),
  )
  return (
    <div>
      <p>
        The <code>[rev]</code> suffix in a locstring navigates to that region in
        the horizontally flipped orientation.
      </p>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/HorizontallyFlipped.tsx">
        Source code
      </a>
    </div>
  )
}

// Example 2: Call horizontallyFlip() from a button outside the JBrowse UI
function FlipButton({ state }: { state: ViewState }) {
  const [error, setError] = useState<unknown>()
  return (
    <div>
      <button
        onClick={() => {
          try {
            state.session.view.horizontallyFlip()
          } catch (e) {
            setError(e)
          }
        }}
      >
        Horizontally flip
      </button>
      {error ? <ErrorMessage error={error} /> : null}
    </div>
  )
}

export const HorizontallyFlippedViaButton = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      location: 'ctgA:1-50000',
    }),
  )
  return (
    <div>
      <p>
        Call <code>state.session.view.horizontallyFlip()</code> at any time to
        toggle the flipped orientation. This toggles on each click, so clicking
        twice returns to normal.
      </p>
      <FlipButton state={state} />
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/HorizontallyFlipped.tsx">
        Source code
      </a>
    </div>
  )
}

// Example 3: Pass reversed:true on displayedRegions in the defaultSession
export const HorizontallyFlippedViaDisplayedRegions = () => {
  const { assembly, tracks } = getVolvoxConfig()
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      defaultSession: {
        name: 'Horizontally flipped via displayedRegions',
        view: {
          type: 'LinearGenomeView',
          offsetPx: 0,
          bpPerPx: 1,
          displayedRegions: [
            {
              refName: 'ctgA',
              start: 0,
              end: 50001,
              reversed: true,
              assemblyName: 'volvox',
            },
          ],
        },
      },
    }),
  )
  return (
    <div>
      <p>
        Set <code>reversed: true</code> on a region in{' '}
        <code>displayedRegions</code> in your <code>defaultSession</code> to
        start in the horizontally flipped orientation.
      </p>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/HorizontallyFlipped.tsx">
        Source code
      </a>
    </div>
  )
}
