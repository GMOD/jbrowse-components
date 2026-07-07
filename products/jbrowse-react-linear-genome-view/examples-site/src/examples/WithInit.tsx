import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'volvox',
  sequence: {
    adapter: {
      type: 'TwoBitAdapter',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
  },
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'volvox_genes',
    name: 'Volvox genes',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'Gff3TabixAdapter',
      uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
    },
  },
]

export default function WithInit() {
  return (
    <LinearGenomeView
      assembly={assembly}
      tracks={tracks}
      init={{ loc: 'ctgA:1,000..20,000', tracks: ['volvox_genes'] }}
    />
  )
}
