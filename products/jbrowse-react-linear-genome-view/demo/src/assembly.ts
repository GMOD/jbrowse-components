const assembly = {
  name: 'GRCh38',
  aliases: ['hg38'],
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'GRCh38-ReferenceSequenceTrack',
    adapter: {
      type: 'BgzipFastaAdapter',
      fastaLocation: {
        uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
      },
      faiLocation: {
        uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.fai',
      },
      gziLocation: {
        uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz.gzi',
      },
    },
    displays: [
      {
        type: 'LinearReferenceSequenceDisplay',
        displayId:
          'GRCh38-ReferenceSequenceTrack-LinearReferenceSequenceDisplay',
        renderer: {
          type: 'DivSequenceRenderer',
        },
      },
    ],
  },
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      location: {
        uri: '/jbrowse-react-linear-genome-view-demo/GRCh38.aliases.txt',
      },
    },
  },
}

export default assembly
