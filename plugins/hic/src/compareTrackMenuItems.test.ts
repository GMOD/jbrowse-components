import {
  comparableTracks,
  comparisonTrackConf,
} from './compareTrackMenuItems.ts'

import type { AbstractSessionModel } from '@jbrowse/core/util'

const hic = (trackId: string, assembly: string, uri: string) => ({
  trackId,
  type: 'HicTrack',
  name: trackId.toUpperCase(),
  assemblyNames: [assembly],
  adapter: { type: 'HicAdapter', uri },
})

const TREATED = hic('treated', 'hg38', 'treated.hic')
const UNTREATED = hic('untreated', 'GRCh38', 'untreated.hic')

function session(tracks: Record<string, unknown>[]) {
  return {
    tracks,
    assemblyManager: {
      getCanonicalAssemblyName: (name: string) =>
        name === 'GRCh38' ? 'hg38' : name,
    },
  } as unknown as AbstractSessionModel
}

test('offers the other Hi-C tracks on the same assembly, aliases included', () => {
  const offered = comparableTracks(
    session([
      TREATED,
      UNTREATED,
      hic('mouse', 'mm10', 'mouse.hic'),
      { trackId: 'genes', type: 'FeatureTrack', assemblyNames: ['hg38'] },
    ]),
    TREATED,
  )
  expect(offered.map(t => t.trackId)).toEqual(['untreated'])
})

test('the comparison track is this map over the other, as observed/control', () => {
  const conf = comparisonTrackConf(TREATED, UNTREATED)
  expect(conf).toMatchObject({
    type: 'HicTrack',
    name: 'TREATED / UNTREATED',
    assemblyNames: ['hg38'],
    adapter: {
      type: 'HicAdapter',
      uri: 'treated.hic',
      controlAdapter: { type: 'HicAdapter', uri: 'untreated.hic' },
    },
    displays: [
      {
        type: 'LinearHicDisplay',
        encoding: { color: 'observed/control' },
      },
    ],
  })
  expect(conf.displays[0]!.displayId).toBe(`${conf.trackId}-LinearHicDisplay`)
})
