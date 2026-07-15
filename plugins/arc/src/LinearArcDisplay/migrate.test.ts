import { migrateLegacyArcRendererConfig } from './migrate.ts'

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
