import { CircularGenomeView } from '@jbrowse/react-circular-genome-view2'

const assembly = {
  name: 'volvox',
  aliases: ['vvx'],
  sequence: {
    adapter: {
      type: 'TwoBitAdapter',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
  },
  refNameAliases: {
    adapter: {
      type: 'FromConfigAdapter',
      features: [
        { refName: 'ctgA', uniqueId: 'alias1', aliases: ['A', 'contigA'] },
        { refName: 'ctgB', uniqueId: 'alias2', aliases: ['B', 'contigB'] },
      ],
    },
  },
}

const tracks = [
  {
    trackId: 'volvox_sv_test',
    name: 'volvox structural variant test',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.dup.vcf.gz',
    category: ['VCF'],
  },
]

export default function Volvox() {
  return (
    <CircularGenomeView
      assembly={assembly}
      tracks={tracks}
      view={{ tracks: ['volvox_sv_test'] }}
    />
  )
}
