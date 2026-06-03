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
    userByteSizeLimit: 1000,
  })
  expect(result).toEqual({ type: 'LinearBasicDisplay' })
})

// height/heightPreConfig → heightOverride is migrated centrally by
// TrackHeightMixin (see TrackHeightMixin.test.ts); migrateBasicSnapshot leaves
// height untouched.

test('migrates legacy trackShowLabels=true to "on"', () => {
  const result = migrateBasicSnapshot({
    trackShowLabels: true,
  })
  expect(result).toEqual({
    configOverrides: { showLabels: 'on' },
  })
})

test('promotes track-prefixed settings into configOverrides', () => {
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
    configOverrides: {
      showLabels: 'off',
      showDescriptions: true,
      subfeatureLabels: 'overlay',
      geneGlyphMode: 'longestCoding',
      displayMode: 'compact',
      displayDirectionalChevrons: true,
    },
  })
})

// A URL `displaySnapshot` or session can set color on the state model (not the
// config schema), so color/connectorColor/utrColor route into configOverrides.
test('routes a state-model color into configOverrides', () => {
  expect(migrateBasicSnapshot({ color: 'green' })).toEqual({
    configOverrides: { color: 'green' },
  })
})

test('routes connectorColor and utrColor into configOverrides', () => {
  expect(
    migrateBasicSnapshot({
      color: 'green',
      connectorColor: 'gray',
      utrColor: 'lightblue',
    }),
  ).toEqual({
    configOverrides: {
      color: 'green',
      connectorColor: 'gray',
      utrColor: 'lightblue',
    },
  })
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
    configOverrides: {
      color: 'green',
      connectorColor: 'gray',
      utrColor: 'lightblue',
      outlineColor: 'black',
    },
  })
})

test('the new color name wins over legacy color1', () => {
  expect(migrateBasicSnapshot({ color: 'green', color1: 'red' })).toEqual({
    configOverrides: { color: 'green' },
  })
})

// An old session's configOverrides map may still carry the legacy color keys;
// rename them in place so reads via getOverride('color') resolve.
test('renames legacy color keys inside existing configOverrides', () => {
  expect(
    migrateBasicSnapshot({
      configOverrides: { color1: 'red', color3: 'pink', outline: 'black' },
    }),
  ).toEqual({
    configOverrides: { color: 'red', utrColor: 'pink', outlineColor: 'black' },
  })
})

// geneGlyphMode's old 'longest' value was removed; it must become
// 'longestCoding' or it fails enum validation on load.
test('migrates legacy trackGeneGlyphMode "longest" to "longestCoding"', () => {
  const result = migrateBasicSnapshot({
    trackGeneGlyphMode: 'longest',
  })
  expect(result).toEqual({
    configOverrides: { geneGlyphMode: 'longestCoding' },
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
    configOverrides: {
      showLabels: 'off',
      displayDirectionalChevrons: false,
    },
  })
})

test('omits track-prefixed entries that are explicitly undefined', () => {
  const result = migrateBasicSnapshot({
    type: 'LinearBasicDisplay',
    trackShowLabels: undefined,
    trackShowDescriptions: undefined,
  })
  expect(result).toEqual({ type: 'LinearBasicDisplay' })
  expect(result).not.toHaveProperty('configOverrides')
})

test('merges migrated entries into existing configOverrides', () => {
  const result = migrateBasicSnapshot({
    type: 'LinearBasicDisplay',
    configOverrides: {
      autoHeight: true,
      outlineColor: 'rgba(0,0,0,0.5)',
    },
    trackShowLabels: false,
  })
  expect(result).toEqual({
    type: 'LinearBasicDisplay',
    configOverrides: {
      autoHeight: true,
      outlineColor: 'rgba(0,0,0,0.5)',
      showLabels: 'off',
    },
  })
})

test('migrated entry wins over a colliding key in existing configOverrides', () => {
  const result = migrateBasicSnapshot({
    configOverrides: { showLabels: true },
    trackShowLabels: false,
  })
  expect(result).toEqual({
    configOverrides: { showLabels: 'off' },
  })
})

test('ignores non-object configOverrides', () => {
  // typeof null === 'object' but the guard rejects null explicitly. A null
  // existingOverrides would otherwise spread as `{ ...null }` which is a
  // no-op in practice — the guard documents intent.
  const result = migrateBasicSnapshot({
    configOverrides: null,
    trackShowLabels: false,
  })
  expect(result).toEqual({
    configOverrides: { showLabels: 'off' },
  })
})

test('does not emit configOverrides when no track-prefixed keys are present', () => {
  const result = migrateBasicSnapshot({
    type: 'LinearBasicDisplay',
    configuration: 'cfg',
  })
  expect(result).not.toHaveProperty('configOverrides')
})

test('preserves existing configOverrides when no migrated entries exist', () => {
  const result = migrateBasicSnapshot({
    configOverrides: { autoHeight: true },
  })
  expect(result).toEqual({
    configOverrides: { autoHeight: true },
  })
})

// Schema for showLabels flipped from boolean → enum; saved sessions with
// boolean values must be normalized in place or they fail schema validation
// on load.
test('normalizes boolean showLabels in existing configOverrides to enum', () => {
  expect(
    migrateBasicSnapshot({
      configOverrides: { showLabels: true, autoHeight: true },
    }),
  ).toEqual({
    configOverrides: { showLabels: 'on', autoHeight: true },
  })
  expect(
    migrateBasicSnapshot({
      configOverrides: { showLabels: false },
    }),
  ).toEqual({
    configOverrides: { showLabels: 'off' },
  })
})

// Composite: a realistic legacy snapshot exercising all branches at once.
// `height` passes through untouched (TrackHeightMixin migrates it to
// `heightOverride`); this function strips and merges the rest.
test('full legacy snapshot: strips and merges', () => {
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
    configOverrides: {
      autoHeight: true,
    },
  })
  expect(result).toEqual({
    type: 'LinearBasicDisplay',
    configuration: 'gene_track',
    height: 180,
    configOverrides: {
      autoHeight: true,
      showLabels: 'off',
      subfeatureLabels: 'below',
    },
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
    userByteSizeLimit: 1,
    trackShowLabels: true,
  })
  expect(result).not.toHaveProperty('blockState')
  expect(result).not.toHaveProperty('showLegend')
  expect(result).not.toHaveProperty('showTooltips')
  expect(result).not.toHaveProperty('userBpPerPxLimit')
  expect(result).not.toHaveProperty('userByteSizeLimit')
  expect(result).not.toHaveProperty('trackShowLabels')
})
