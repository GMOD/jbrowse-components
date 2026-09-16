import { diagonalizeRegions } from '@jbrowse/core/util/diagonalizeRegions'
import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { CircularViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})
jest.mock('@jbrowse/core/util/diagonalizeRegions', () => {
  const actual = jest.requireActual('@jbrowse/core/util/diagonalizeRegions')
  return {
    ...actual,
    diagonalizeRegions: jest.fn(actual.diagonalizeRegions),
  }
})

const PAF = {
  localPath: require.resolve('./test_data/mirror.paf'),
  locationType: 'LocalPathLocation' as const,
}

function assemblyConf(name: string, contigs: string[]) {
  return {
    name,
    sequence: {
      trackId: `${name}_refseq`,
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: contigs.map(refName => ({
          refName,
          uniqueId: `${name}-${refName}`,
          start: 0,
          end: 1000,
          seq: 'a'.repeat(1000),
        })),
      },
    },
  }
}

// A reorder the launch asked for and that threw used to leave the ribbons on
// their loading ring for the session, with the reason only in a toast. The
// ring's error state and its Retry are where it belongs.
test('a failed launch reorder shows on the ribbons, and Retry runs it again', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest
    .mocked(diagonalizeRegions)
    .mockRejectedValueOnce(new Error('reorder fell over'))
  const session = createTestSession() as any
  session.addAssemblyConf(assemblyConf('A', ['a1', 'a2', 'a3']))
  session.addAssemblyConf(assemblyConf('B', ['b1', 'b2', 'b3']))
  session.addSessionTrackConf({
    trackId: 'aln',
    name: 'A vs B',
    type: 'SyntenyTrack',
    assemblyNames: ['B', 'A'],
    adapter: {
      type: 'PAFAdapter',
      pafLocation: PAF,
      queryAssembly: 'B',
      targetAssembly: 'A',
    },
  })
  const view = (await session.launchView('CircularView', {
    assembly: ['A', 'B'],
    tracks: ['aln'],
    autoDiagonalize: true,
  })) as CircularViewModel
  view.setWidth(800)
  await when(() => view.tracks.length > 0, { timeout: 30000 })
  const display = view.tracks[0]!.displays[0]! as unknown as {
    ready: boolean
    displayPhase: string
    displayError: unknown
    reload: () => void
  }

  await when(() => display.displayPhase === 'error', { timeout: 30000 })
  expect(`${display.displayError}`).toMatch(/reorder fell over/)
  expect(view.awaitingAutoDiagonalize).toBe(false)

  display.reload()
  await when(() => display.ready, { timeout: 30000 })
  expect(view.pendingAutoDiagonalize).toBe(false)
  expect(view.displayedRegions.some(r => r.reversed)).toBe(true)
}, 40000)
