import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

const cramTrackId = 'NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome'

const tracks = [
  {
    trackId: cramTrackId,
    name: 'NA12878 Exome',
    uri: 'https://jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
  },
]

export default function AlignmentsDisplay() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'hg38',
        uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
        refNameAliases: {
          uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
        },
        geneticCodes: { chrM: 2 },
      }}
      tracks={tracks}
      view={{
        loc: 'chr1:100,987,200..100,987,450',
        tracks: [
          {
            trackId: cramTrackId,
            displaySnapshot: {
              type: 'LinearAlignmentsDisplay',
              height: 250,
              showSoftClipping: true,
              color: { field: 'pairOrientation' },
            },
          },
        ],
      }}
    />
  )
}
