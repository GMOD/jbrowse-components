import React from 'react'

// replace with from '@jbrowse/react-circular-genome-view' in your code
import { createViewState, JBrowseCircularGenomeView } from '../../src'

export const ShowTrack = () => {
  const defaultSession = {
    name: 'Storybook',
    view: {
      bpPerPx: 90,
      displayedRegions: [
        {
          assemblyName: 'volvox',
          end: 50001,
          refName: 'ctgA',
          start: 0,
        },
        {
          assemblyName: 'volvox',
          end: 6079,
          refName: 'ctgB',
          start: 0,
        },
      ],
      id: 'circularView',

      type: 'CircularView',
    },
  }
  const state = createViewState({
    assembly: {
      aliases: ['vvx'],
      name: 'volvox',
      refNameAliases: {
        adapter: {
          adapterId: 'W6DyPGJ0UU',
          features: [
            {
              aliases: ['A', 'contigA'],
              refName: 'ctgA',
              uniqueId: 'alias1',
            },
            {
              aliases: ['B', 'contigB'],
              refName: 'ctgB',
              uniqueId: 'alias2',
            },
          ],
          type: 'FromConfigAdapter',
        },
      },
      sequence: {
        adapter: {
          twoBitLocation: {
            locationType: 'UriLocation',
            uri: 'test_data/volvox/volvox.2bit',
          },
          type: 'TwoBitAdapter',
        },
        metadata: {
          date: '2020-08-20',
        },
        trackId: 'volvox_refseq',
        type: 'ReferenceSequenceTrack',
      },
    },
    defaultSession,
    tracks: [
      {
        adapter: {
          index: {
            location: {
              locationType: 'UriLocation',
              uri: 'test_data/volvox/volvox.dup.vcf.gz.tbi',
            },
          },
          type: 'VcfTabixAdapter',
          vcfGzLocation: {
            locationType: 'UriLocation',
            uri: 'test_data/volvox/volvox.dup.vcf.gz',
          },
        },
        assemblyNames: ['volvox'],
        category: ['VCF'],
        name: 'volvox structural variant test',
        trackId: 'volvox_sv_test',
        type: 'VariantTrack',
      },
    ],
  })

  state.session.view.showTrack('volvox_sv_test')
  return (
    <div>
      <JBrowseCircularGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-circular-genome-view/stories/examples/ShowTrack.tsx">
        Source code
      </a>
    </div>
  )
}
