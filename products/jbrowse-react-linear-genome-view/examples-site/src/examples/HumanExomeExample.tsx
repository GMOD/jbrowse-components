import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'GRCh38',
  sequence: {
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
    },
  },
  aliases: ['hg38'],
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
    assemblyNames: ['GRCh38'],
    adapter: {
      type: 'Gff3TabixAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
    },
  },
  {
    type: 'AlignmentsTrack',
    trackId: 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome',
    name: 'NA12878 Exome',
    assemblyNames: ['GRCh38'],
    adapter: {
      type: 'CramAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
    },
  },
]

// managed API: props are initial values, the component owns the engine
export default function HumanExomeExample() {
  return (
    <LinearGenomeView
      assembly={assembly}
      tracks={tracks}
      init={{
        loc: '1:100,987,269..100,987,368',
        tracks: ['NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome'],
      }}
    />
  )
}
