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

const hits = [
  { label: 'gene1', refName: 'ctgA', start: 1050, end: 9000 },
  { label: 'gene2', refName: 'ctgA', start: 20000, end: 23000 },
  { label: 'gene3', refName: 'ctgB', start: 100, end: 1500 },
]

export default function App() {
  const [state] = useState(() =>
    createViewState({ assembly, tracks, location: 'ctgA:1,000..5,000' }),
  )
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        {hits.map(h => (
          <button
            key={h.label}
            style={{ marginRight: 8 }}
            onClick={() => {
              state.session.view
                .navToLocations([{ refName: h.refName, start: h.start, end: h.end }])
                .catch((e: unknown) => {
                  console.error(e)
                })
            }}
          >
            {h.label}
          </button>
        ))}
      </div>
      <JBrowseLinearGenomeView viewState={state} />
    </div>
  )
}
