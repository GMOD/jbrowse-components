import React from 'react'
// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view'
import { createViewState, JBrowseLinearGenomeView } from '../../src'

import { addRelativeUris, getVolvoxConfig } from './util'

export const WithAggregateTextSearching = () => {
  const { assembly } = getVolvoxConfig()
  const textSearchConfig = {
    assembly,
    aggregateTextSearchAdapters: [
      {
        type: 'TrixTextSearchAdapter',
        textSearchAdapterId: 'volvox-index',
        ixFilePath: {
          uri: 'storybook_data/volvox.ix',
          locationType: 'UriLocation',
        },
        ixxFilePath: {
          uri: 'storybook_data/volvox.ixx',
          locationType: 'UriLocation',
        },
        metaFilePath: {
          uri: 'storybook_data/volvox_meta.json',
          locationType: 'UriLocation',
        },
        assemblyNames: ['volvox'],
      },
    ],
    tracks: [
      {
        type: 'FeatureTrack',
        trackId: 'gff3tabix_genes',
        assemblyNames: ['volvox'],
        name: 'GFF3Tabix genes',
        category: ['Miscellaneous'],
        adapter: {
          type: 'Gff3TabixAdapter',
          gffGzLocation: {
            uri: 'volvox.sort.gff3.gz',
            locationType: 'UriLocation',
          },
          index: {
            location: {
              uri: 'volvox.sort.gff3.gz.tbi',
              locationType: 'UriLocation',
            },
          },
        },
      },
      {
        type: 'FeatureTrack',
        trackId: 'single_exon_gene',
        category: ['Miscellaneous'],
        name: 'Single exon gene',
        assemblyNames: ['volvox'],
        adapter: {
          type: 'Gff3TabixAdapter',
          gffGzLocation: {
            uri: 'single_exon_gene.sorted.gff.gz',
            locationType: 'UriLocation',
          },
          index: {
            location: {
              uri: 'single_exon_gene.sorted.gff.gz.tbi',
              locationType: 'UriLocation',
            },
          },
        },
      },
      {
        type: 'VariantTrack',
        trackId: 'volvox.inv.vcf',
        name: 'volvox inversions',
        category: ['VCF'],
        assemblyNames: ['volvox'],
        adapter: {
          type: 'VcfTabixAdapter',
          vcfGzLocation: {
            uri: 'volvox.inv.vcf.gz',
            locationType: 'UriLocation',
          },
          index: {
            location: {
              uri: 'volvox.inv.vcf.gz.tbi',
              locationType: 'UriLocation',
            },
            indexType: 'TBI',
          },
        },
      },
    ],
    // use 1-based coordinates for locstring
    location: 'ctgA:1..800',
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
