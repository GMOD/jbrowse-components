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
    view: { loc: 'ctgA:1-50000' },
  })
  const flipped = useCreateViewState({
    assembly,
    tracks,
    view: { loc: 'ctgA:1-50000[rev]' },
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
