const assembly = {
  name: 'volvox',
  aliases: ['vvx'],
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    metadata: {
      date: '2020-08-20',
    },
    formatAbout: {
      hideUris: true,
      config: "jexl:{extraField:'important data'}",
    },
    adapter: {
      type: 'TwoBitAdapter',
      twoBitLocation: {
        uri: 'test_data/volvox.2bit',
        locationType: 'UriLocation',
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

export default assembly
