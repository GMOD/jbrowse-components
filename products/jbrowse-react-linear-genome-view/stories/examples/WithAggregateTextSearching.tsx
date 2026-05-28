// in your code:
// import {createViewState, JBrowseLinearGenomeView} from '@jbrowse/react-linear-genome-view2'
import { useState } from 'react'

import { addRelativeUris, getVolvoxConfig } from './util.tsx'
import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

export const WithAggregateTextSearching = () => {
  const { assembly } = getVolvoxConfig()
  const [state] = useState(() => {
    const textSearchConfig = {
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
      tracks: [
        {
          type: 'FeatureTrack',
          trackId: 'gff3tabix_genes',
          assemblyNames: ['volvox'],
          name: 'GFF3Tabix genes',
          category: ['Miscellaneous'],
          adapter: {
            type: 'Gff3TabixAdapter',
            uri: 'volvox.sort.gff3.gz',
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
            uri: 'single_exon_gene.sorted.gff.gz',
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
            uri: 'volvox.inv.vcf.gz',
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
    return createViewState(textSearchConfig)
  })
  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/WithAggregateTextSearching.tsx">
        Source code
      </a>
    </div>
  )
}
