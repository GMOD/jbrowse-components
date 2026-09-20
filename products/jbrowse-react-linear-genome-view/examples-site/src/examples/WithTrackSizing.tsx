import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'hg19',
  aliases: ['GRCh37'],
  uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
  refNameAliases: {
    uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt',
  },
}

const adapter = {
  type: 'Gff3TabixAdapter',
  uri: 'https://jbrowse.org/ucsc/hg19/ncbiRefSeq.gff.gz',
  csi: true,
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'refseq_grow',
    name: 'NCBI RefSeq — grow (expand to fit all features)',
    assemblyNames: ['hg19'],
    adapter,
    displayDefaults: {
      heightMode: 'grow',
    },
  },
  {
    type: 'FeatureTrack',
    trackId: 'refseq_fit',
    name: 'NCBI RefSeq — fit (squeeze all features into view)',
    assemblyNames: ['hg19'],
    adapter,
    displayDefaults: {
      heightMode: 'fit',
      height: 150,
    },
  },
]

export default function WithTrackSizing() {
  return (
    <LinearGenomeView
      assembly={assembly}
      tracks={tracks}
      view={{
        loc: 'chr17:7,560,000..7,600,000',
        tracks: ['refseq_grow', 'refseq_fit'],
      }}
    />
  )
}
