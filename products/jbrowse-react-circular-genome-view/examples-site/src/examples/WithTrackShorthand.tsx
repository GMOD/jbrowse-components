import { CircularGenomeView } from '@jbrowse/react-circular-genome-view2'

export default function WithTrackShorthand() {
  return (
    <CircularGenomeView
      assembly={{
        name: 'volvox',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
      }}
      tracks={[
        {
          trackId: 'volvox_sv',
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.dup.vcf.gz',
          name: 'Volvox duplications',
        },
      ]}
      view={{ tracks: ['volvox_sv'] }}
    />
  )
}
