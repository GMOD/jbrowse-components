import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

export default function MultiSampleVariants() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'volvox',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
      }}
      tracks={[
        {
          type: 'VariantTrack',
          trackId: 'volvox_multisample_sv',
          name: 'volvox multi-sample SV',
          assemblyNames: ['volvox'],
          adapter: {
            type: 'VcfTabixAdapter',
            uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sv.vcf.gz',
            samplesTsvLocation: {
              uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sv.samples.tsv',
            },
          },
          displayDefaults: { rows: { color: 'population' } },
        },
      ]}
      view={{
        loc: 'ctgA:1..50,000',
        tracks: ['volvox_multisample_sv'],
      }}
    />
  )
}
