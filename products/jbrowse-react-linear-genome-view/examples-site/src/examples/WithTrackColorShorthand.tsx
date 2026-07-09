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
    trackId: 'volvox_genes_green',
    name: 'Volvox genes (green via shorthand)',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'Gff3TabixAdapter',
      uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
    },
    // list appearance settings in a `displayDefaults` object and JBrowse applies
    // each one to the right display for you (here the track's LinearBasicDisplay)
    // — no need to know display names or write the full `displays` array. A
    // `jexl:` value works here too, e.g. "jexl:get(feature,'type')=='CDS'?'red':'blue'"
    displayDefaults: { color: 'green' },
  },
]

// managed API: props are initial values, the component owns the engine — no
// createViewState / useState ceremony
export default function App() {
  return (
    <LinearGenomeView
      assembly={assembly}
      tracks={tracks}
      init={{ loc: 'ctgA:1..50,000', tracks: ['volvox_genes_green'] }}
    />
  )
}
