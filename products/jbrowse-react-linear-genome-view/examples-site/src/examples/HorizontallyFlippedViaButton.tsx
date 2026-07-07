import { useRef, useState } from 'react'
import type { RefObject } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import {
  LinearGenomeView,
  type ViewModel,
} from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'volvox',
  sequence: {
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

function FlipButton({ viewRef }: { viewRef: RefObject<ViewModel | null> }) {
  const [error, setError] = useState<unknown>()
  return (
    <div>
      <button
        onClick={() => {
          try {
            viewRef.current?.session.view.horizontallyFlip()
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
  const ref = useRef<ViewModel>(null)
  return (
    <div>
      <FlipButton viewRef={ref} />
      <LinearGenomeView
        ref={ref}
        assembly={assembly}
        tracks={tracks}
        init={{ loc: 'ctgA:1-50000' }}
      />
    </div>
  )
}
