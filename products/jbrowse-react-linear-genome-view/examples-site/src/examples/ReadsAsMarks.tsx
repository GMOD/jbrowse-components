import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'hg38',
  uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
  refNameAliases: {
    uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
  },
  geneticCodes: { chrM: 2 },
}

const tracks = [
  {
    trackId: 'hg002_snrpn',
    name: 'HG002 SNRPN reads by haplotype',
    uri: 'https://jbrowse.org/demos/methylation/HG002_SNRPN_5mC_haplotagged.bam',
    type: 'AlignmentsTrack',
    displays: [
      {
        type: 'LinearMarkDisplay',
        displayId: 'hg002_snrpn-LinearMarkDisplay',
        height: 400,
        transform: [
          { type: 'formula', expr: "jexl:getTag(feature,'HP')", as: 'HP' },
        ],
        facet: 'HP',
        marks: [
          {
            mark: 'span',
            transform: [{ type: 'pileup' }],
            encoding: {
              row: 'row',
              color: { field: 'HP', scale: 'categorical', title: 'Haplotype' },
            },
          },
        ],
      },
    ],
  },
]

export default function ReadsAsMarks() {
  return (
    <LinearGenomeView
      assembly={assembly}
      tracks={tracks}
      view={{ loc: 'chr15:24,954,000..24,972,000', tracks: ['hg002_snrpn'] }}
    />
  )
}
