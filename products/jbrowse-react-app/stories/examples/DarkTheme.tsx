// replace with this in your code:
// import {createViewState,JBrowseApp} from '@jbrowse/react-app2'
import { JBrowseApp, createViewState } from '../../src/index.ts'

export const DarkTheme = () => {
  const state = createViewState({
    config: {
      configuration: {
        theme: {
          palette: {
            mode: 'dark',
          },
        },
      },
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

      defaultSession: {
        name: 'Integration test example',
        views: [
          {
            id: 'integration_test',
            type: 'LinearGenomeView',
            offsetPx: 2000,
            bpPerPx: 0.05,
            displayedRegions: [
              {
                refName: 'ctgA',
                start: 0,
                end: 50001,
                assemblyName: 'volvox',
              },
            ],
          },
        ],
      },
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
    },
  })
  state.session.views[0]?.showTrack('volvox_cram')

  return (
    <div>
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-app/stories/examples/BasicExample.tsx">
        Source code
      </a>
      <JBrowseApp viewState={state} />
    </div>
  )
}
