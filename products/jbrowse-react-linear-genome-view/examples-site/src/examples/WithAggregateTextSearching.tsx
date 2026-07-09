import { useState } from 'react'

import {
  JBrowseLinearGenomeView,
  createViewState,
} from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'volvox',
  sequence: {
    adapter: {
      type: 'TwoBitAdapter',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
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
      uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
    },
  },
]

export default function App() {
  const [state] = useState(() =>
    createViewState({
      assembly,
      aggregateTextSearchAdapters: [
        {
          type: 'TrixTextSearchAdapter',
          textSearchAdapterId: 'volvox-index',
          ixFilePath: { uri: 'storybook_data/volvox.ix' },
          ixxFilePath: { uri: 'storybook_data/volvox.ixx' },
          metaFilePath: { uri: 'storybook_data/volvox_meta.json' },
          assemblyNames: ['volvox'],
        },
      ],
      tracks,
      location: 'ctgA:1..800',
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}
