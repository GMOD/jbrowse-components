const tracks = [
  {
    type: 'VariantTrack',
    trackId: 'volvox_sv_test_renamed',
    name: 'volvox structural variant test w/renamed refs',
    category: ['VCF'],
    assemblyNames: ['volvox'],
    adapter: {
      type: 'VcfTabixAdapter',
      vcfGzLocation: {
        uri: 'test_data/volvox.dup.renamed.vcf.gz',
        locationType: 'UriLocation',
      },
      index: {
        location: {
          uri: 'test_data/volvox.dup.renamed.vcf.gz.tbi',
          locationType: 'UriLocation',
        },
      },
    },
  },
]

export default tracks
