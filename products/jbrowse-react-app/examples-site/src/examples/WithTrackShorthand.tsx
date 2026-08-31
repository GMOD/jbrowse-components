import { JBrowse } from '@jbrowse/react-app2'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

// The assembly is a name and a sequence file; each track is an id and a data
// file. JBrowse reads the track type and the adapter off the extension —
// .cram an AlignmentsTrack over CramAdapter, .gff3.gz a FeatureTrack over
// Gff3TabixAdapter, .bw a QuantitativeTrack over BigWigAdapter — and derives
// each index sibling. This config declares one assembly, so the tracks belong
// to it without naming it; with two, each track states its own assemblyNames.
const assemblies = [
  { name: 'volvox', uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
]

const tracks = [
  { trackId: 'reads', uri: `${base}/volvox-sorted.cram` },
  { trackId: 'genes', uri: `${base}/volvox.sort.gff3.gz` },
  // a key beside uri wins over the guess, so a track that wants a name, a
  // folder in the track selector or a color of its own still fits the shorthand
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
