import { CircularGenomeView } from '@jbrowse/react-circular-genome-view2'

const assembly = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
}

const tracks = [
  {
    trackId: 'volvox_sv',
    name: 'Volvox breakends',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.dup.vcf.gz',
  },
]

export default function Volvox() {
  return (
    <CircularGenomeView
      assembly={assembly}
      tracks={tracks}
      view={{ tracks: ['volvox_sv'] }}
    />
  )
}
