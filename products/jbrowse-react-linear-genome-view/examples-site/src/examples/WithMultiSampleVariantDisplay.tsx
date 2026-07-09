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

// A multi-sample VCF (one genotype column per sample) plus a samples TSV that
// maps each sample to metadata. The TSV's first column is the sample name; the
// remaining columns (here "population") become groupable/colorable attributes.
const tracks = [
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
        displayId: 'volvox_multisample_sv-LinearMultiSampleVariantDisplay',
        // colorBy names a samples-TSV column. On initial track load the samples
        // are grouped and colored by this attribute (here, population).
        //
        // colorBy / renderingMode / minorAlleleFrequencyFilter are config slots
        // (SharedVariantConfigSchema): set them directly here to change a
        // display's default. Swap `type` to
        // 'LinearMultiSampleVariantMatrixDisplay' for the matrix view, and set
        // renderingMode: 'phased' (phased VCFs only) for haplotype rows. To
        // preset these on a saved session's display *instance* instead, put
        // them as flat keys on that display's snapshot (e.g. renderingMode:
        // 'phased' directly in the display object).
        colorBy: 'population',
      },
    ],
  },
]

// managed API: props are initial values, the component owns the engine
export default function App() {
  return (
    <LinearGenomeView
      assembly={assembly}
      tracks={tracks}
      init={{
        loc: 'ctgA:1..50,000',
        // opening by trackId auto-selects displays[0] from the track config
        // (LinearMultiSampleVariantDisplay), so no displaySnapshot is needed
        tracks: ['volvox_multisample_sv'],
      }}
    />
  )
}
