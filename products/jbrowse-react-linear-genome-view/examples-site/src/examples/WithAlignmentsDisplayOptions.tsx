import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'GRCh38',
  aliases: ['hg38'],
  uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/fasta/GRCh38.fa.gz',
  refNameAliases: {
    uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
  },
  geneticCodes: { MT: 2 },
}

const tracks = [
  {
    type: 'AlignmentsTrack',
    trackId: 'hg002_snrpn_5mc',
    name: 'HG002 SNRPN 5mC (haplotagged nanopore)',
    assemblyNames: ['GRCh38'],
    adapter: {
      type: 'BamAdapter',
      uri: 'https://jbrowse.org/demos/methylation/HG002_SNRPN_5mC_haplotagged.bam',
    },
  },
]

export default function WithAlignmentsDisplayOptions() {
  return (
    <LinearGenomeView
      assembly={assembly}
      tracks={tracks}
      view={{
        loc: 'chr15:24,954,000..24,972,000',
        tracks: [
          {
            trackId: 'hg002_snrpn_5mc',
            displaySnapshot: {
              type: 'LinearAlignmentsDisplay',
              height: 500,
              color: { field: 'tags.HP' },
              facet: 'tags.HP',
            },
          },
        ],
      }}
    />
  )
}
