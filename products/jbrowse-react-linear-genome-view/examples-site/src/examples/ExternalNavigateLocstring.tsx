import { useState } from 'react'

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

const bookmarks = [
  { label: 'ctgA — region A', loc: 'ctgA:1,000..5,000' },
  { label: 'ctgA — region B', loc: 'ctgA:20,000..25,000' },
  { label: 'ctgB — region C', loc: 'ctgB:1..2,000' },
]

export default function App() {
  const [state] = useState(() =>
    createViewState({ assembly, tracks, location: 'ctgA:1,000..5,000' }),
  )
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        {bookmarks.map(b => (
          <button
            key={b.loc}
            style={{ marginRight: 8 }}
            onClick={() => {
              state.session.view.navToLocString(b.loc).catch((e: unknown) => {
                console.error(e)
              })
            }}
          >
            {b.label}
          </button>
        ))}
      </div>
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
}
