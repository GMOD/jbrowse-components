import { migrateGCContentSnapshot } from './migration.ts'

test('renames legacy windowSize/windowDelta/gcMode to their *Override names', () => {
  expect(
    migrateGCContentSnapshot({
      type: 'LinearGCContentDisplay',
      windowSize: 100,
      windowDelta: 50,
      gcMode: 'skew',
    }),
  ).toEqual({
    type: 'LinearGCContentDisplay',
    windowSizeOverride: 100,
    windowDeltaOverride: 50,
    gcModeOverride: 'skew',
  })
})

test('does not overwrite an existing override with a stale legacy field', () => {
  const result = migrateGCContentSnapshot({
    windowSize: 100,
    windowSizeOverride: 200,
  })
  expect(result).toMatchObject({ windowSizeOverride: 200 })
  expect(result).not.toHaveProperty('windowSize')
})

test('leaves a snapshot with no GC params unchanged', () => {
  const result = migrateGCContentSnapshot({ type: 'LinearGCContentDisplay' })
  expect(result).toEqual({ type: 'LinearGCContentDisplay' })
  expect(result).not.toHaveProperty('windowSize')
})

test('handles undefined', () => {
  expect(migrateGCContentSnapshot(undefined)).toBeUndefined()
})

test('strips legacy BaseLinearDisplay fields', () => {
  const result = migrateGCContentSnapshot({
    type: 'LinearGCContentDisplay',
    blockState: { x: 1 },
    showLegend: true,
    showTooltips: false,
  })
  expect(result).toEqual({ type: 'LinearGCContentDisplay' })
})
