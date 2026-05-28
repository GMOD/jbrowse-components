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
    heightPreConfig: 200,
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

test('lifts height to heightPreConfig', () => {
  const result = migrateBasicSnapshot({
    type: 'LinearBasicDisplay',
    height: 150,
  })
  expect(result).toEqual({
    type: 'LinearBasicDisplay',
    heightPreConfig: 150,
  })
})

// Regression: a partially-migrated session may already have heightPreConfig
// (newer field) AND height (legacy artifact). The new value must win, otherwise
// re-saving a session would overwrite the user's chosen height with whatever
// the old snapshot had.
test('does not overwrite existing heightPreConfig', () => {
  const result = migrateBasicSnapshot({
    type: 'LinearBasicDisplay',
    height: 150,
    heightPreConfig: 200,
  })
  expect(result).toEqual({
    type: 'LinearBasicDisplay',
    heightPreConfig: 200,
  })
})

test('does not add heightPreConfig when neither field is present', () => {
  const result = migrateBasicSnapshot({
    type: 'LinearBasicDisplay',
  })
  expect(result).toEqual({ type: 'LinearBasicDisplay' })
  expect(result).not.toHaveProperty('heightPreConfig')
})

// Legacy trackShowLabels: true used to mean "always show labels". The enum
// has no equivalent — 'on' would be the literal translation, but defaulting
// users to 'auto' preserves the visible-at-sparse-zooms behavior they had
// while gaining the density-based hide at zoom-out. This test pins that
// intent in case someone "fixes" the mapping to 'on'.
test('migrates legacy trackShowLabels=true to "auto"', () => {
  const result = migrateBasicSnapshot({
    trackShowLabels: true,
  })
  expect(result).toEqual({
    configOverrides: { showLabels: 'auto' },
  })
})

test('promotes track-prefixed settings into configOverrides', () => {
  const result = migrateBasicSnapshot({
    type: 'LinearBasicDisplay',
    trackShowLabels: false,
    trackShowDescriptions: true,
    trackSubfeatureLabels: 'overlay',
    trackGeneGlyphMode: 'longest',
    trackDisplayMode: 'compact',
    trackDisplayDirectionalChevrons: true,
  })
  expect(result).toEqual({
    type: 'LinearBasicDisplay',
    configOverrides: {
      showLabels: 'off',
      showDescriptions: true,
      subfeatureLabels: 'overlay',
      geneGlyphMode: 'longest',
      displayMode: 'compact',
      displayDirectionalChevrons: true,
    },
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
      outline: 'rgba(0,0,0,0.5)',
    },
    trackShowLabels: false,
  })
  expect(result).toEqual({
    type: 'LinearBasicDisplay',
    configOverrides: {
      autoHeight: true,
      outline: 'rgba(0,0,0,0.5)',
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
    configOverrides: { showLabels: 'auto', autoHeight: true },
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
test('full legacy snapshot: strips, lifts, and merges', () => {
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
    heightPreConfig: 180,
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
    height: 100,
    trackShowLabels: true,
  })
  expect(result).not.toHaveProperty('blockState')
  expect(result).not.toHaveProperty('showLegend')
  expect(result).not.toHaveProperty('showTooltips')
  expect(result).not.toHaveProperty('userBpPerPxLimit')
  expect(result).not.toHaveProperty('userByteSizeLimit')
  expect(result).not.toHaveProperty('height')
  expect(result).not.toHaveProperty('trackShowLabels')
})
