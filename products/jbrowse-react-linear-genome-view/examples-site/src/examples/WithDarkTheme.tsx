import { useState } from 'react'
import { createViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'

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
      gffGzLocation: { uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz' },
      index: { location: { uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz.tbi' } },
    },
  },
]

export default function App() {
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks,
      configuration: {
        theme: {
          palette: {
            mode: 'dark',
            primary: { main: '#333' },
            secondary: { main: '#444' },
          },
        },
      },
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}
