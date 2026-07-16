import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

export default function WithGtfTrack() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'volvox',
        sequence: {
          adapter: {
            type: 'TwoBitAdapter',
            uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
          },
        },
      }}
      tracks={[
        {
          type: 'FeatureTrack',
          trackId: 'volvox_genes_gtf',
          name: 'Genes (GTF)',
          assemblyNames: ['volvox'],
          adapter: {
            // a real GENCODE record (TP53), remapped into volvox ctgA coordinates. A
            // plain (un-indexed) GTF; the `uri` shorthand also accepts a gzipped
            // file. For large files use a GtfTabixAdapter on a bgzipped,
            // tabix-indexed GTF instead (sort + index with `jbrowse sort-gff`)
            type: 'GtfAdapter',
            uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox_genes.gtf',
            // GTF has no spanning gene line, so transcripts are grouped into a gene
            // via this attribute (default 'gene_name'); set it to whatever your file
            // keys genes on, e.g. 'gene_id'
            aggregateField: 'gene_name',
          },
        },
      ]}
      init={{ loc: 'ctgA:500..20,500', tracks: ['volvox_genes_gtf'] }}
    />
  )
}
