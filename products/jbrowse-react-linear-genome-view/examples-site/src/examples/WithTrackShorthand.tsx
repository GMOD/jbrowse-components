import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

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
        {
          trackId: 'duplications',
          uri: `${base}/volvox.dup.vcf.gz`,
          name: 'Duplications',
          displayDefaults: { color: 'purple' },
        },
      ]}
      view={{
        loc: 'ctgA:1..50,000',
        tracks: ['genes', 'microarray', 'duplications'],
      }}
    />
  )
}
