import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

// managed API: props are initial values, the component owns the engine
export default function WithMultiSampleVariantDisplay() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'volvox',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
      }}
      // A multi-sample VCF (one genotype column per sample) plus a samples TSV
      // that maps each sample to metadata. The TSV's first column is the sample
      // name; the remaining columns (here "population") become
      // groupable/colorable attributes.
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
              // colorBy names a samples-TSV column to group/color by. Swap
              // `type` to 'LinearMultiSampleVariantMatrixDisplay' for the matrix
              // view, or add renderingMode: 'phased' (phased VCFs) for haplotypes
              colorBy: 'population',
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
