// shared render-side config for the managed <LinearGenomeView> stories. the
// per-story `source.code` strings inline their own copy so they stay
// copy-pasteable; this helper is render-only (never shown in source.code)

export const assembly = {
  name: 'hg38',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'P6R5xbRqRr',
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
    },
  },
}

export const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'ncbi-refseq-genes',
    name: 'NCBI RefSeq Genes',
    assemblyNames: ['hg38'],
    adapter: {
      type: 'Gff3TabixAdapter',
      gffGzLocation: { uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz' },
      index: {
        location: { uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi' },
        indexType: 'CSI',
      },
    },
  },
]

export const bookmarks = [
  { label: 'region A', loc: 'chr1:11,106,077-11,261,675' },
  { label: 'region B', loc: 'chr2:20,000..25,000' },
]
