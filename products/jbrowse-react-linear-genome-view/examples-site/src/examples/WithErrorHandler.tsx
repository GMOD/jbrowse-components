import { useState } from 'react'
import { ErrorBanner } from '@jbrowse/core/ui'
import {
  createViewState,
  JBrowseLinearGenomeView,
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
      gffGzLocation: { uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz' },
      index: { location: { uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz.tbi' } },
    },
  },
]

export default function App() {
  const [{ viewState, error }] = useState(() => {
    try {
      return {
        viewState: createViewState({
          assembly,
          tracks: [
            {
              type: 'BadTrack',
              notProperTrack: 'error',
              shouldHaveTrackIdAndStuff: 'test',
            },
          ],
          location: 'ctgA:1105..1221',
        }),
        error: undefined as unknown,
      }
    } catch (e) {
      return { viewState: undefined, error: e }
    }
  })
  return error ? (
    <ErrorBanner error={error} />
  ) : viewState ? (
    <JBrowseLinearGenomeView viewState={viewState} />
  ) : (
    'Loading...'
  )
}
