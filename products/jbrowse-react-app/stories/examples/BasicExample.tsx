// replace with this in your code:
// import { createViewState, JBrowseApp } from '@jbrowse/react-app2'
import { useState } from 'react'

import { JBrowseApp, createViewState } from '../../src/index.ts'

export const BasicExample = () => {
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
                uri: 'volvox.2bit',
              },
            },
            refNameAliases: {
              adapter: {
                type: 'FromConfigAdapter',
                adapterId: 'W6DyPGJ0UU',
                features: [
                  {
                    refName: 'ctgA',
                    uniqueId: 'alias1',
                    aliases: ['A', 'contigA'],
                  },
                  {
                    refName: 'ctgB',
                    uniqueId: 'alias2',
                    aliases: ['B', 'contigB'],
                  },
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
              uri: 'volvox-sorted.cram',
              locationType: 'UriLocation',
              sequenceAdapter: {
                type: 'TwoBitAdapter',
                uri: 'volvox.2bit',
              },
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
              },
            },
          ],
        },
      },
    }),
  )

  return (
    <div>
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-app/stories/examples/BasicExample.tsx">
        Source code
      </a>
      <JBrowseApp viewState={state} />
    </div>
  )
}
