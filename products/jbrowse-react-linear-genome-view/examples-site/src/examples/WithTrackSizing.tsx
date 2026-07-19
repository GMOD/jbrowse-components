import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

// hg19 with the NCBI RefSeq gene track. The TP53 locus stacks its many
// transcript isoforms into far more rows than a fixed height can show, so the
// track-sizing strategy is visible at a glance.
const assembly = {
  name: 'hg19',
  aliases: ['GRCh37'],
  uri: 'https://jbrowse.org/genomes/hg19/fasta/hg19.fa.gz',
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/hg19_aliases.txt',
    },
  },
}

// The same GFF3, opened twice under different trackIds so the two track-sizing
// strategies sit side by side. `heightMode` is a display config slot, so it
// routes through the `displayDefaults` shorthand.
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
    // grow: the track grows tall enough to show every stacked row at full size
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
    // fit: the rows scale down so everything fits within the fixed `height`
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
      init={{
        loc: 'chr17:7,560,000..7,600,000',
        tracks: ['refseq_grow', 'refseq_fit'],
      }}
    />
  )
}
