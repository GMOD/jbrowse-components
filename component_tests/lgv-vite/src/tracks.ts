const tracks = [
  {
    type: 'AlignmentsTrack',
    trackId: 'volvox_cram',
    name: 'volvox-sorted.cram',
    assemblyNames: ['volvox'],
    category: ['Alignments'],
    adapter: {
      type: 'CramAdapter',
      cramLocation: {
        uri: 'volvox-sorted.cram',
        locationType: 'UriLocation',
      },
      craiLocation: {
        uri: 'volvox-sorted.cram.crai',
        locationType: 'UriLocation',
      },
    },
  },
]

export default tracks
