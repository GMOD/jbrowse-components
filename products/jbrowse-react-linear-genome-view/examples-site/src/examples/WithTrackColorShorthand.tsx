import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

export default function WithTrackColorShorthand() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'volvox',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
      }}
      tracks={[
        {
          type: 'FeatureTrack',
          trackId: 'volvox_genes_green',
          name: 'Volvox genes (green via shorthand)',
          assemblyNames: ['volvox'],
          adapter: {
            type: 'Gff3TabixAdapter',
            uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
          },
          displayDefaults: { color: 'green' },
        },
      ]}
      view={{ loc: 'ctgA:1..50,000', tracks: ['volvox_genes_green'] }}
    />
  )
}
