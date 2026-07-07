import { useState } from 'react'

import {
  JBrowseLinearGenomeView,
  useCreateViewState,
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

// This component renders the genome view. Because it uses useCreateViewState,
// parent re-renders (e.g. from the counter above) do not reset the browser.
function GenomeView() {
  const state = useCreateViewState({
    assembly,
    tracks,
    location: 'ctgA:1105..1221',
  })
  return <JBrowseLinearGenomeView viewState={state} />
}

export default function UseCreateViewState() {
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
    </div>
  )
}
