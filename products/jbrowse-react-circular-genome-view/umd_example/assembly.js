export default {
  name: 'volvox',
  aliases: ['vvx'],
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'TwoBitAdapter',
      twoBitLocation: {
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/volvox/volvox.2bit',
      },
    },
  },
  refNameAliases: {
    adapter: {
      type: 'FromConfigAdapter',
      adapterId: 'W6DyPGJ0UU',
      features: [
        {
          refName: 'ctgA',
          uniqueId: 'alias1',
          aliases: ['A', 'contigA'],
        },
        {
          refName: 'ctgB',
          uniqueId: 'alias2',
          aliases: ['B', 'contigB'],
        },
      ],
    },
  },
}
