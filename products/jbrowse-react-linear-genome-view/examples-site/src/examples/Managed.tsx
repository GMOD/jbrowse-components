import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'hg38',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'P6R5xbRqRr',
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
    },
  },
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
    },
  },
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'ncbi-refseq-genes',
    name: 'NCBI RefSeq Genes',
    assemblyNames: ['hg38'],
    adapter: {
      type: 'Gff3TabixAdapter',
      gffGzLocation: { uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz' },
      index: {
        location: {
          uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi',
        },
        indexType: 'CSI',
      },
    },
  },
]

// no useState, no createViewState — props are initial values, the component
// constructs and owns the engine. swap assembly/plugins by remounting via key
export default function Managed() {
  return (
    <LinearGenomeView
      assembly={assembly}
      tracks={tracks}
      init={{
        loc: 'chr1:11,106,077-11,261,675',
        tracks: ['ncbi-refseq-genes'],
      }}
    />
  )
}
