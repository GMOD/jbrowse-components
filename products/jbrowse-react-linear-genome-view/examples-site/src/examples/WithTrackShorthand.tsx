import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

// A track is its id and its file. JBrowse reads the track type and the adapter
// off the extension — .gff3.gz a FeatureTrack over Gff3TabixAdapter, .bw a
// QuantitativeTrack over BigWigAdapter, .vcf.gz a VariantTrack over
// VcfTabixAdapter — derives each index sibling, and names the track after the
// file. This embed has one assembly, so the tracks are on it without saying so.
export default function WithTrackShorthand() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'volvox',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
      }}
      tracks={[
        { trackId: 'genes', uri: `${base}/volvox.sort.gff3.gz` },
        { trackId: 'microarray', uri: `${base}/volvox_microarray.bw` },
        // any key beside uri wins over the guess, so the shorthand does not
        // run out when one track needs a name and a color of its own
        {
          trackId: 'duplications',
          uri: `${base}/volvox.dup.vcf.gz`,
          name: 'Duplications',
          displayDefaults: { color: 'purple' },
        },
      ]}
      init={{
        loc: 'ctgA:1..50,000',
        tracks: ['genes', 'microarray', 'duplications'],
      }}
    />
  )
}
