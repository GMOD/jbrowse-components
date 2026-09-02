import { useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

import type { ViewModel } from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'volvox_gff3',
    name: 'Volvox genes',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'Gff3TabixAdapter',
      uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
    },
  },
]

// imperative toggle via the view's horizontallyFlip() action. The engine is
// built by the hook and passed down as a plain value once it exists, so this
// takes a ViewModel rather than a ref to one: `<LinearGenomeView ref>` would
// hand over a RefObject to thread through and a `?.` at every use for a value
// that is never actually absent here.
function FlipButton({ viewState }: { viewState: ViewModel }) {
  const [error, setError] = useState<unknown>()
  return (
    <div>
      <button
        onClick={() => {
          try {
            viewState.session.view.horizontallyFlip()
          } catch (e) {
            setError(e)
          }
        }}
      >
        Horizontally flip
      </button>
      {error ? <ErrorBanner error={error} /> : null}
    </div>
  )
}

export default function HorizontallyFlip() {
  const state = useCreateViewState({
    assembly,
    tracks,
    init: { loc: 'ctgA:1-50000' },
  })
  const flipped = useCreateViewState({
    assembly,
    tracks,
    // the same view, opened already reversed: [rev] is part of the locstring,
    // so it travels through a saved session or a shared URL like any other
    init: { loc: 'ctgA:1-50000[rev]' },
  })
  return (
    <div>
      <h3>Flip imperatively from a button</h3>
      {state ? (
        <>
          <FlipButton viewState={state} />
          <JBrowseLinearGenomeView viewState={state} />
        </>
      ) : null}
      <h3>Open already flipped via a [rev] locstring</h3>
      {flipped ? <JBrowseLinearGenomeView viewState={flipped} /> : null}
    </div>
  )
}
