import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
}

const tracks = [
  {
    trackId: 'volvox_gff3',
    name: 'Volvox genes',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
  },
]

export default function TwoViews() {
  return (
    <div>
      <LinearGenomeView
        assembly={assembly}
        tracks={tracks}
        view={{ loc: 'ctgA:1105..1221' }}
      />
      <LinearGenomeView
        assembly={assembly}
        tracks={tracks}
        view={{ loc: 'ctgA:5560..30589' }}
      />
    </div>
  )
}
