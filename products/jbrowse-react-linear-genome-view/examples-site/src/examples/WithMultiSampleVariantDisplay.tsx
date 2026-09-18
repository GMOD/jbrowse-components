import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

export default function WithMultiSampleVariantDisplay() {
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
            uri: 'https://raw.githubusercontent.com/GMOD/jbrowse-components/main/test_data/volvox/volvox.sv.vcf.gz',
            samplesTsvLocation: {
              uri: 'https://raw.githubusercontent.com/GMOD/jbrowse-components/main/test_data/volvox/volvox.sv.samples.tsv',
            },
          },
          displays: [
            {
              type: 'LinearMultiSampleVariantDisplay',
              displayId:
                'volvox_multisample_sv-LinearMultiSampleVariantDisplay',
              rowColor: 'population',
            },
          ],
        },
      ]}
      init={{
        loc: 'ctgA:1..50,000',
        tracks: ['volvox_multisample_sv'],
      }}
    />
  )
}
