import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

const cramTrackId = 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome'

const tracks = [
  {
    type: 'AlignmentsTrack',
    trackId: cramTrackId,
    name: 'NA12878 Exome',
    assemblyNames: ['GRCh38'],
    adapter: {
      type: 'CramAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
    },
  },
]

// managed API: props are initial values, the component owns the engine
export default function WithInitAlignmentsDisplay() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'GRCh38',
        aliases: ['hg38'],
        sequence: {
          adapter: {
            type: 'BgzipFastaAdapter',
            uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
          },
        },
        refNameAliases: {
          adapter: {
            type: 'RefNameAliasAdapter',
            uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
          },
        },
      }}
      tracks={tracks}
      init={{
        loc: '1:100,987,200..100,987,450',
        tracks: [
          {
            trackId: cramTrackId,
            displaySnapshot: {
              type: 'LinearAlignmentsDisplay',
              height: 250,
              showSoftClipping: true,
              colorBy: { type: 'pairOrientation' },
            },
          },
        ],
      }}
    />
  )
}
