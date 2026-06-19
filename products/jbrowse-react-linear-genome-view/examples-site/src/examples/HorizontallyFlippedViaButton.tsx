import { useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import {
  JBrowseLinearGenomeView,
  createViewState,
} from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'TwoBitAdapter',
      twoBitLocation: { uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
    },
  },
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'volvox_gff3',
    name: 'Volvox genes',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'Gff3TabixAdapter',
      gffGzLocation: {
        uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
      },
      index: {
        location: {
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz.tbi',
        },
      },
    },
  },
]

type ViewState = ReturnType<typeof createViewState>

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
      {error ? <ErrorBanner error={error} /> : null}
    </div>
  )
}

export default function App() {
  const [state] = useState(() =>
    createViewState({ assembly, tracks, location: 'ctgA:1-50000' }),
  )
  return (
    <div>
      <FlipButton state={state} />
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
}
