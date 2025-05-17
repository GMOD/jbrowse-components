const tracks = [
  {
    type: 'VariantTrack',
    trackId: 'volvox_sv_test_renamed',
    name: 'volvox structural variant test w/renamed refs',
    category: ['VCF'],
    assemblyNames: ['volvox'],
    adapter: {
      type: 'VcfAdapter',
      vcfLocation: {
        uri: 'volvox.dup.renamed.vcf',
        locationType: 'UriLocation',
      },
    },
  },
]

export default tracks
