import { CircularGenomeView } from '@jbrowse/react-circular-genome-view2'

// The same volvox structural variants, written as short as the config goes: the
// assembly is a name and a sequence file, and the track is an id and a data
// file. A .vcf.gz resolves to a VariantTrack over VcfTabixAdapter, whose chord
// display is the one a circular view draws, and the `.tbi` sibling comes with
// it. This embed has one assembly, so the track is on it without saying so.
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
      init={{ tracks: ['volvox_sv'] }}
    />
  )
}
