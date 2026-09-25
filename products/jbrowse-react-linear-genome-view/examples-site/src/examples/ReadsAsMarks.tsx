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
    trackId: 'hg002_snrpn',
    name: 'HG002 SNRPN reads by haplotype',
    assemblyNames: ['GRCh38'],
    adapter: {
      type: 'BamAdapter',
      uri: 'https://jbrowse.org/demos/methylation/HG002_SNRPN_5mC_haplotagged.bam',
    },
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
