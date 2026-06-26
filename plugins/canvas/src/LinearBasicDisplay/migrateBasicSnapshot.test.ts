import { migrateBasicSnapshot } from './migrateBasicSnapshot.ts'

test('undefined snapshot passes through', () => {
  expect(migrateBasicSnapshot(undefined)).toBeUndefined()
})

test('empty snapshot returns empty object', () => {
  expect(migrateBasicSnapshot({})).toEqual({})
})

test('non-migrated snapshot passes through unchanged', () => {
  const snap = {
    type: 'LinearBasicDisplay',
    configuration: 'cfg',
    heightOverride: 200,
  }
  expect(migrateBasicSnapshot(snap)).toEqual(snap)
})

test('strips removed FeatureDensityMixin fields', () => {
  const result = migrateBasicSnapshot({
    type: 'LinearBasicDisplay',
    blockState: { foo: 1 },
    showLegend: true,
    showTooltips: false,
    userBpPerPxLimit: 0.5,
  })
  expect(result).toEqual({ type: 'LinearBasicDisplay' })
})

// height/heightPreConfig → heightOverride is migrated centrally by
// TrackHeightMixin (see TrackHeightMixin.test.ts); migrateBasicSnapshot leaves
// height untouched.

test('migrates legacy trackShowLabels=true to flat showLabels: "auto"', () => {
  const result = migrateBasicSnapshot({ trackShowLabels: true })
  expect(result).toEqual({ showLabels: 'auto' })
})

test('promotes track-prefixed settings to flat keys', () => {
  const result = migrateBasicSnapshot({
    type: 'LinearBasicDisplay',
    trackShowLabels: false,
    trackShowDescriptions: true,
    trackSubfeatureLabels: 'overlay',
    trackGeneGlyphMode: 'longestCoding',
    trackDisplayMode: 'compact',
    trackDisplayDirectionalChevrons: true,
  })
  expect(result).toEqual({
    type: 'LinearBasicDisplay',
    showLabels: 'off',
    showDescriptions: true,
    subfeatureLabels: 'overlay',
    geneGlyphMode: 'longestCoding',
    displayMode: 'compact',
    displayDirectionalChevrons: true,
  })
})

// A URL `displaySnapshot` or session can set color on the state model (not the
// config schema), so color/connectorColor/utrColor route through flat.
test('routes a state-model color through flat', () => {
  expect(migrateBasicSnapshot({ color: 'green' })).toEqual({ color: 'green' })
})

test('routes connectorColor and utrColor through flat', () => {
  expect(
    migrateBasicSnapshot({
      color: 'green',
      connectorColor: 'gray',
      utrColor: 'lightblue',
    }),
  ).toEqual({ color: 'green', connectorColor: 'gray', utrColor: 'lightblue' })
})

// Legacy color1/color2/color3/outline in a state-model snapshot map onto the
// new names.
test('maps legacy color1/color2/color3/outline in a state-model snapshot', () => {
  expect(
    migrateBasicSnapshot({
      color1: 'green',
      color2: 'gray',
      color3: 'lightblue',
      outline: 'black',
    }),
  ).toEqual({
    color: 'green',
    connectorColor: 'gray',
    utrColor: 'lightblue',
    outlineColor: 'black',
  })
})

test('the new color name wins over legacy color1', () => {
  expect(migrateBasicSnapshot({ color: 'green', color1: 'red' })).toEqual({
    color: 'green',
  })
})

// geneGlyphMode's old 'longest' value was removed; it must become
// 'longestCoding' or it fails enum validation on load.
test('migrates legacy trackGeneGlyphMode "longest" to "longestCoding"', () => {
  const result = migrateBasicSnapshot({ trackGeneGlyphMode: 'longest' })
  expect(result).toEqual({ geneGlyphMode: 'longestCoding' })
})

// The removed `collapse`/`reducedRepresentation` displayMode values map back to
// `normal` so a stale flat override still passes the narrowed enum on load.
test('normalizes removed displayMode override values to normal', () => {
  expect(migrateBasicSnapshot({ displayMode: 'collapse' })).toEqual({
    displayMode: 'normal',
  })
  expect(
    migrateBasicSnapshot({ displayMode: 'reducedRepresentation' }),
  ).toEqual({ displayMode: 'normal' })
})

test('leaves a valid displayMode override untouched', () => {
  expect(migrateBasicSnapshot({ displayMode: 'compact' })).toEqual({
    displayMode: 'compact',
  })
})

// `false` and `0` are valid override values; the migration must distinguish
// "explicitly set to falsy" from "absent". Pre-fix risk: a `!val` check would
// drop these silently.
test('preserves falsy track-prefixed values', () => {
  const result = migrateBasicSnapshot({
    trackShowLabels: false,
    trackDisplayDirectionalChevrons: false,
  })
  expect(result).toEqual({
    showLabels: 'off',
    displayDirectionalChevrons: false,
  })
})

test('omits track-prefixed entries that are explicitly undefined', () => {
  const result = migrateBasicSnapshot({
    type: 'LinearBasicDisplay',
    trackShowLabels: undefined,
    trackShowDescriptions: undefined,
  })
  expect(result).toEqual({ type: 'LinearBasicDisplay' })
})

// Composite: a realistic legacy snapshot exercising all branches at once.
// `height` passes through untouched (TrackHeightMixin migrates it to
// `heightOverride`); this function strips and promotes the rest.
test('full legacy snapshot: strips and promotes', () => {
  const result = migrateBasicSnapshot({
    type: 'LinearBasicDisplay',
    configuration: 'gene_track',
    blockState: { irrelevant: true },
    showLegend: true,
    showTooltips: false,
    userBpPerPxLimit: 1,
    userByteSizeLimit: 5000,
    height: 180,
    trackShowLabels: false,
    trackSubfeatureLabels: 'below',
  })
  expect(result).toEqual({
    type: 'LinearBasicDisplay',
    configuration: 'gene_track',
    userByteSizeLimit: 5000,
    height: 180,
    showLabels: 'off',
    subfeatureLabels: 'below',
  })
})

// The output must not retain any of the stripped keys, even when other parts
// of the snapshot were migrated — easy to regress by adding a new field to the
// destructure but forgetting to keep it out of `rest`.
test('stripped keys never appear in the result', () => {
  const result = migrateBasicSnapshot({
    blockState: 'x',
    showLegend: true,
    showTooltips: true,
    userBpPerPxLimit: 1,
    trackShowLabels: true,
  })
  expect(result).not.toHaveProperty('blockState')
  expect(result).not.toHaveProperty('showLegend')
  expect(result).not.toHaveProperty('showTooltips')
  expect(result).not.toHaveProperty('userBpPerPxLimit')
  expect(result).not.toHaveProperty('trackShowLabels')
})

// userByteSizeLimit is a live field in RegionTooLargeMixin (composed via
// MultiRegionDisplayMixin) — it persists the user's force-load threshold so it
// survives session restore. Do not strip it.
test('userByteSizeLimit passes through', () => {
  const result = migrateBasicSnapshot({ userByteSizeLimit: 1000 })
  expect(result).toHaveProperty('userByteSizeLimit', 1000)
})
