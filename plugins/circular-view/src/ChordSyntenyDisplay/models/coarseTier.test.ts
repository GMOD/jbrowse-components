import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { CircularViewModel } from '../../CircularView/model.ts'
import type { Feature } from '@jbrowse/core/util'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// one alignment, written by make-pif in both tiers: the fine rows carry its
// CIGAR, the coarse rows the fold of it
const PIF =
  require.resolve('../../../../../test_data/volvox/volvox_ins_coarse.pif.gz')

function assemblyConf(name: string, length: number) {
  return {
    name,
    sequence: {
      trackId: `${name}_refseq`,
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: `${name}-ctgA`,
            start: 0,
            end: length,
            seq: 'a'.repeat(length),
          },
        ],
      },
    },
  }
}

test('a ribbon track reads the coarse tier of an indexed pairwise file', async () => {
  const session = createTestSession() as any
  session.addAssemblyConf(assemblyConf('volvox', 50001))
  session.addAssemblyConf(assemblyConf('volvox_ins', 54801))
  session.addSessionTrackConf({
    trackId: 'aln',
    name: 'volvox_ins vs volvox',
    type: 'SyntenyTrack',
    assemblyNames: ['volvox_ins', 'volvox'],
    adapter: {
      type: 'PairwiseIndexedPAFAdapter',
      pifGzLocation: { localPath: PIF, locationType: 'LocalPathLocation' },
      index: {
        location: {
          localPath: `${PIF}.tbi`,
          locationType: 'LocalPathLocation',
        },
      },
      queryAssembly: 'volvox_ins',
      targetAssembly: 'volvox',
    },
  })
  const view = (await session.launchView('CircularView', {
    assembly: ['volvox', 'volvox_ins'],
    tracks: ['aln'],
  })) as CircularViewModel
  view.setWidth(800)
  await when(() => view.pendingLaunch === undefined, { timeout: 30000 })
  const display = view.chordSyntenyDisplays[0] as unknown as {
    features?: Feature[]
    displayError: unknown
  }
  await when(
    () => display.features !== undefined || display.displayError !== undefined,
    { timeout: 30000 },
  )
  expect(display.displayError).toBeUndefined()
  expect(
    display.features!.map(f => [f.get('CIGAR'), typeof f.get('coarseCigar')]),
  ).toEqual([[undefined, 'string']])
}, 40000)
