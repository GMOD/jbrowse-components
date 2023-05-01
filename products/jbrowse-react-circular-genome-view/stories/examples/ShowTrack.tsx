import React from 'react'

// replace with from '@jbrowse/react-circular-genome-view' in your code
import { createViewState, JBrowseCircularGenomeView } from '../../src'

export const ShowTrack = () => {
  const defaultSession = {
    name: 'Storybook',
    view: {
      id: 'circularView',
      type: 'CircularView',
      bpPerPx: 90,

      displayedRegions: [
        {
          refName: 'ctgA',
          start: 0,
          end: 50001,
          assemblyName: 'volvox',
        },
        {
          refName: 'ctgB',
          start: 0,
          end: 6079,
          assemblyName: 'volvox',
        },
      ],
    },
  }
  const state = createViewState({
    assembly: {
      name: 'volvox',
      aliases: ['vvx'],
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: 'volvox_refseq',
        metadata: {
          date: '2020-08-20',
        },
        adapter: {
          type: 'TwoBitAdapter',
          twoBitLocation: {
            uri: 'test_data/volvox/volvox.2bit',
            locationType: 'UriLocation',
          },
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
    tracks: [
      {
        type: 'VariantTrack',
        trackId: 'volvox_sv_test',
        name: 'volvox structural variant test',
        category: ['VCF'],
        assemblyNames: ['volvox'],
        adapter: {
          type: 'VcfTabixAdapter',
          vcfGzLocation: {
            uri: 'test_data/volvox/volvox.dup.vcf.gz',
            locationType: 'UriLocation',
          },
          index: {
            location: {
              uri: 'test_data/volvox/volvox.dup.vcf.gz.tbi',
              locationType: 'UriLocation',
            },
          },
        },
      },
    ],
    defaultSession,
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
