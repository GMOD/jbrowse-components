import {
  migrateArcSnapshot,
  migrateLegacyArcRendererConfig,
} from './migrate.ts'

test('passes through a config that has no renderer', () => {
  const snap = {
    type: 'LinearArcDisplay',
    displayId: 'arc_linear',
    color: 'green',
  }
  expect(migrateLegacyArcRendererConfig(snap)).toEqual(snap)
})

test('strips a bare ArcRenderer renderer, leaving defaults', () => {
  expect(
    migrateLegacyArcRendererConfig({
      type: 'LinearArcDisplay',
      displayId: 'arc_linear',
      renderer: { type: 'ArcRenderer' },
    }),
  ).toEqual({
    type: 'LinearArcDisplay',
    displayId: 'arc_linear',
  })
})

test('hoists renderer slots onto the display config', () => {
  expect(
    migrateLegacyArcRendererConfig({
      type: 'LinearArcDisplay',
      renderer: {
        type: 'ArcRenderer',
        color: 'red',
        thickness: 5,
        label: 'mylabel',
        caption: 'mycaption',
        displayMode: 'semicircles',
      },
    }),
  ).toEqual({
    type: 'LinearArcDisplay',
    color: 'red',
    thickness: 5,
    label: 'mylabel',
    caption: 'mycaption',
    displayMode: 'semicircles',
  })
})

test('renames renderer.height to arcHeight to avoid the base height slot', () => {
  expect(
    migrateLegacyArcRendererConfig({
      type: 'LinearArcDisplay',
      renderer: {
        type: 'ArcRenderer',
        height: `jexl:log10(get(feature,'end')-get(feature,'start'))*20`,
      },
    }),
  ).toEqual({
    type: 'LinearArcDisplay',
    arcHeight: `jexl:log10(get(feature,'end')-get(feature,'start'))*20`,
  })
})

test('drops unknown renderer keys but keeps other top-level keys', () => {
  expect(
    migrateLegacyArcRendererConfig({
      type: 'LinearArcDisplay',
      height: 200,
      renderer: { type: 'ArcRenderer', somethingUnknown: 1, color: 'blue' },
    }),
  ).toEqual({
    type: 'LinearArcDisplay',
    height: 200,
    color: 'blue',
  })
})

// migrateArcSnapshot: state-model back-compat for the displayMode →
// displayModeOverride field rename

test('migrateArcSnapshot: renames legacy displayMode to displayModeOverride', () => {
  expect(
    migrateArcSnapshot({
      type: 'LinearArcDisplay',
      displayMode: 'semicircles',
    }),
  ).toEqual({ type: 'LinearArcDisplay', displayModeOverride: 'semicircles' })
})

test('migrateArcSnapshot: leaves an existing displayModeOverride untouched', () => {
  const snap = { type: 'LinearArcDisplay', displayModeOverride: 'arcs' }
  expect(migrateArcSnapshot(snap)).toEqual(snap)
})

test('migrateArcSnapshot: does not overwrite displayModeOverride with a stale displayMode', () => {
  const snap = {
    type: 'LinearArcDisplay',
    displayMode: 'arcs',
    displayModeOverride: 'semicircles',
  }
  expect(migrateArcSnapshot(snap)).toEqual(snap)
})

test('migrateArcSnapshot: passes through a snapshot with neither field', () => {
  const snap = { type: 'LinearArcDisplay' }
  expect(migrateArcSnapshot(snap)).toEqual(snap)
})

test('migrateArcSnapshot: handles undefined', () => {
  expect(migrateArcSnapshot(undefined)).toBeUndefined()
})
