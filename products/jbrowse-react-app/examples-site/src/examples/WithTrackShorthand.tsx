import { JBrowse } from '@jbrowse/react-app2'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

const assemblies = [
  { name: 'volvox', uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
]

const tracks = [
  { trackId: 'reads', uri: `${base}/volvox-sorted.cram` },
  { trackId: 'genes', uri: `${base}/volvox.sort.gff3.gz` },
  {
    trackId: 'microarray',
    uri: `${base}/volvox_microarray.bw`,
    name: 'Microarray signal',
    category: ['Quantitative'],
  },
]

export default function WithTrackShorthand() {
  return (
    <JBrowse
      assemblies={assemblies}
      tracks={tracks}
      views={[
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1..50000',
          tracks: ['reads', 'genes', 'microarray'],
          tracklist: true,
        },
      ]}
    />
  )
}
