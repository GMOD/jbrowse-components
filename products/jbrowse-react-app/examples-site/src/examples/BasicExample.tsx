import { useState } from 'react'

import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

export default function BasicExample() {
  const [state] = useState(() =>
    createViewState({
      config: {
        assemblies: [
          {
            name: 'volvox',
            sequence: {
              type: 'ReferenceSequenceTrack',
              trackId: 'volvox_refseq',
              adapter: {
                type: 'TwoBitAdapter',
                uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
              },
            },
            refNameAliases: {
              adapter: {
                type: 'FromConfigAdapter',
                adapterId: 'W6DyPGJ0UU',
                features: [
                  { refName: 'ctgA', uniqueId: 'alias1', aliases: ['A'] },
                  { refName: 'ctgB', uniqueId: 'alias2', aliases: ['B'] },
                ],
              },
            },
          },
        ],
        tracks: [
          {
            type: 'AlignmentsTrack',
            trackId: 'volvox_cram',
            name: 'volvox-sorted.cram',
            assemblyNames: ['volvox'],
            category: ['Alignments'],
            adapter: {
              type: 'CramAdapter',
              uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox-sorted.cram',
            },
          },
        ],
        defaultSession: {
          name: 'My session',
          views: [
            {
              id: 'view1',
              type: 'LinearGenomeView',
              init: {
                assembly: 'volvox',
                loc: 'ctgA:1..50000',
                tracks: ['volvox_cram'],
                tracklist: true,
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}
