import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

export default function DisableAddTrack() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'volvox',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
      }}
      tracks={[
        {
          type: 'FeatureTrack',
          trackId: 'volvox_gff3',
          name: 'Volvox genes',
          assemblyNames: ['volvox'],
          adapter: {
            type: 'Gff3TabixAdapter',
            uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
          },
        },
      ]}
      view={{ loc: 'ctgA:1105..1221', tracks: ['volvox_gff3'] }}
      disableAddTracks
    />
  )
}
