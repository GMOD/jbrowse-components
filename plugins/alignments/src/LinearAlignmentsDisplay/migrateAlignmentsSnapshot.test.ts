import { migrateAlignmentsSnapshot } from './migrateAlignmentsSnapshot.ts'

describe('migrateAlignmentsSnapshot', () => {
  test('returns undefined snapshot unchanged', () => {
    expect(migrateAlignmentsSnapshot(undefined)).toBeUndefined()
  })

  test('leaves a current LinearAlignmentsDisplay snapshot untouched', () => {
    const snap = {
      type: 'LinearAlignmentsDisplay',
      configuration: 'track-1',
      userByteLimit: 5000000,
    }
    expect(migrateAlignmentsSnapshot(snap)).toEqual(snap)
  })

  test.each([
    'LinearPileupDisplay',
    'LinearReadArcsDisplay',
    'LinearReadCloudDisplay',
    'LinearSNPCoverageDisplay',
  ])('remaps %s → LinearAlignmentsDisplay', type => {
    const result = migrateAlignmentsSnapshot({ type, displayId: 'd1' })
    expect(result?.type).toBe('LinearAlignmentsDisplay')
    expect(result?.displayId).toBe('d1')
  })

  // Real display props survive the remap; legacy config-slot keys ride along as
  // unknown top-level keys and are dropped by MST on load (settings revert to
  // the config default) — nothing here strips them.
  test('preserves real display props through the type remap', () => {
    const result = migrateAlignmentsSnapshot({
      type: 'LinearPileupDisplay',
      configuration: 'track-1',
      userByteLimit: 15284906,
    })
    expect(result?.type).toBe('LinearAlignmentsDisplay')
    expect(result?.configuration).toBe('track-1')
    expect(result?.userByteLimit).toBe(15284906)
  })
})
