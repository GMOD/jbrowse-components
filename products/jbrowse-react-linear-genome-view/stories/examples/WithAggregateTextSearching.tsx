import React from 'react'
// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view'
import { createViewState, JBrowseLinearGenomeView } from '../../src'

import { addRelativeUris, getVolvoxConfig } from './util'

export const WithAggregateTextSearching = () => {
  const { assembly } = getVolvoxConfig()
  const textSearchConfig = {
    aggregateTextSearchAdapters: [
      {
        assemblyNames: ['volvox'],
        ixFilePath: {
          locationType: 'UriLocation',
          uri: 'storybook_data/volvox.ix',
        },
        ixxFilePath: {
          locationType: 'UriLocation',
          uri: 'storybook_data/volvox.ixx',
        },
        metaFilePath: {
          locationType: 'UriLocation',
          uri: 'storybook_data/volvox_meta.json',
        },
        textSearchAdapterId: 'volvox-index',
        type: 'TrixTextSearchAdapter',
      },
    ],
    assembly,
    // use 1-based coordinates for locstring
    location: 'ctgA:1..800',

    tracks: [
      {
        adapter: {
          gffGzLocation: {
            locationType: 'UriLocation',
            uri: 'volvox.sort.gff3.gz',
          },
          index: {
            location: {
              locationType: 'UriLocation',
              uri: 'volvox.sort.gff3.gz.tbi',
            },
          },
          type: 'Gff3TabixAdapter',
        },
        assemblyNames: ['volvox'],
        category: ['Miscellaneous'],
        name: 'GFF3Tabix genes',
        trackId: 'gff3tabix_genes',
        type: 'FeatureTrack',
      },
      {
        adapter: {
          gffGzLocation: {
            locationType: 'UriLocation',
            uri: 'single_exon_gene.sorted.gff.gz',
          },
          index: {
            location: {
              locationType: 'UriLocation',
              uri: 'single_exon_gene.sorted.gff.gz.tbi',
            },
          },
          type: 'Gff3TabixAdapter',
        },
        assemblyNames: ['volvox'],
        category: ['Miscellaneous'],
        name: 'Single exon gene',
        trackId: 'single_exon_gene',
        type: 'FeatureTrack',
      },
      {
        adapter: {
          index: {
            indexType: 'TBI',
            location: {
              locationType: 'UriLocation',
              uri: 'volvox.inv.vcf.gz.tbi',
            },
          },
          type: 'VcfTabixAdapter',
          vcfGzLocation: {
            locationType: 'UriLocation',
            uri: 'volvox.inv.vcf.gz',
          },
        },
        assemblyNames: ['volvox'],
        category: ['VCF'],
        name: 'volvox inversions',
        trackId: 'volvox.inv.vcf',
        type: 'VariantTrack',
      },
    ],
  }
  const configPath = 'test_data/volvox/config.json'
  addRelativeUris(
    textSearchConfig,
    new URL(configPath, window.location.href).href,
  )
  const state = createViewState(textSearchConfig)
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithAggregateTextSearching.tsx">
        Source code
      </a>
    </div>
  )
}
