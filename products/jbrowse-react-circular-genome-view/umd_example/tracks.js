export default [
  {
    type: 'VariantTrack',
    trackId: 'volvox_sv_test',
    name: 'volvox structural variant test',
    category: ['VCF'],
    assemblyNames: ['volvox'],
    adapter: {
      type: 'VcfTabixAdapter',
      vcfGzLocation: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/volvox/volvox.dup.vcf.gz',
      },
      index: {
        location: {
          uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/volvox/volvox.dup.vcf.gz.tbi',
        },
      },
    },
  },
]
