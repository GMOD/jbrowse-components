// Fully inline config: no data files to fetch, so a failure here is always the
// plugin or the packages it resolved against, never a flaky asset load.
const seq = 'ATGC'.repeat(250)

export const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          uniqueId: 'ctgA',
          refName: 'ctgA',
          start: 0,
          end: seq.length,
          seq,
        },
      ],
    },
  },
}

export const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'volvox_scores',
    name: 'Scored features',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'FromConfigAdapter',
      features: Array.from({ length: 20 }, (_, i) => ({
        uniqueId: `feat${i}`,
        refName: 'ctgA',
        start: i * 50,
        end: i * 50 + 40,
        score: (i % 10) + 1,
      })),
    },
    displays: [
      {
        type: 'LinearScoreDisplay',
        displayId: 'volvox_scores_LinearScoreDisplay',
      },
    ],
  },
]
