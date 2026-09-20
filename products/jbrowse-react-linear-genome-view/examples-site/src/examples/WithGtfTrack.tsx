import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

export default function WithGtfTrack() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'volvox',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
      }}
      tracks={[
        {
          type: 'FeatureTrack',
          trackId: 'volvox_genes_gtf',
          name: 'Genes (GTF)',
          assemblyNames: ['volvox'],
          adapter: {
            type: 'GtfAdapter',
            uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox_genes.gtf',
            aggregateField: 'gene_name',
          },
        },
      ]}
      view={{ loc: 'ctgA:500..20,500', tracks: ['volvox_genes_gtf'] }}
    />
  )
}
