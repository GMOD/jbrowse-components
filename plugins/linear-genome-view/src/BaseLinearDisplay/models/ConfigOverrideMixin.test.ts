import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { getSnapshot, isStateTreeNode, types } from '@jbrowse/mobx-state-tree'

import ConfigOverrideMixin, {
  migrateOldSettingSnapshots,
} from './ConfigOverrideMixin.ts'

// Basic mixin with declared config keys (no outer preProcessSnapshot)
const TestModel = types.compose(
  'TestDisplay',
  ConfigOverrideMixin(['color', 'scaleType', 'minScore']),
  types.model({ name: types.optional(types.string, 'test') }),
)

// Simulates a display that also has its own preProcessSnapshot (migration).
// The outer hook runs first (MST composition order), then ConfigOverrideMixin's
// inner hook collects the flat keys it produced.
const MigratingModel = types
  .compose(
    'MigratingDisplay',
    ConfigOverrideMixin(['color', 'displayMode']),
    types.model({ name: types.optional(types.string, 'test') }),
  )
  .preProcessSnapshot((snap: Record<string, unknown> | undefined) => {
    if (!snap) {
      return snap
    }
    // Rename legacyColor → color (flat output, as real migration functions do).
    const { legacyColor, ...rest } = snap
    if (legacyColor === undefined) {
      return snap
    }
    return { ...rest, color: legacyColor }
  })

describe('ConfigOverrideMixin — flat snapshot format', () => {
  it('starts with empty overrides, snapshot has no extra keys', () => {
    const model = TestModel.create({})
    expect(model.configOverrides).toEqual({})
    expect(getSnapshot(model)).not.toHaveProperty('configOverrides')
    expect(getSnapshot(model)).not.toHaveProperty('color')
  })

  it('setOverride stores a value and snapshot is flat (no configOverrides key)', () => {
    const model = TestModel.create({})
    model.setOverride('color', 'red')
    const snap = getSnapshot(model)
    expect(snap).not.toHaveProperty('configOverrides')
    expect((snap as Record<string, unknown>).color).toBe('red')
  })

  it('getOverride returns undefined for missing keys', () => {
    const model = TestModel.create({})
    expect(model.getOverride('missing')).toBeUndefined()
  })

  it('clearOverride removes a value and snapshot becomes empty', () => {
    const model = TestModel.create({})
    model.setOverride('color', 'red')
    model.clearOverride('color')
    const snap = getSnapshot(model)
    expect(snap).not.toHaveProperty('color')
    expect(snap).not.toHaveProperty('configOverrides')
  })

  it('setOverride with undefined clears the key (same as clearOverride)', () => {
    const model = TestModel.create({})
    model.setOverride('color', 'red')
    model.setOverride('color', undefined)
    const snap = getSnapshot(model) as Record<string, unknown>
    expect(snap).not.toHaveProperty('color')
    expect(snap).not.toHaveProperty('configOverrides')
    expect(model.getOverride('color')).toBeUndefined()
  })

  it('multiple overrides all appear flat in snapshot', () => {
    const model = TestModel.create({})
    model.setOverride('color', 'red')
    model.setOverride('scaleType', 'log')
    model.setOverride('minScore', 5)
    const snap = getSnapshot(model) as Record<string, unknown>
    expect(snap).not.toHaveProperty('configOverrides')
    expect(snap.color).toBe('red')
    expect(snap.scaleType).toBe('log')
    expect(snap.minScore).toBe(5)
  })

  it('setOverride replaces existing value', () => {
    const model = TestModel.create({})
    model.setOverride('color', 'red')
    model.setOverride('color', 'blue')
    expect(model.getOverride('color')).toBe('blue')
  })
})

describe('ConfigOverrideMixin — loading snapshots', () => {
  it('loads flat config keys from a snapshot', () => {
    const model = TestModel.create({ color: 'red', scaleType: 'log' } as never)
    expect(model.getOverride('color')).toBe('red')
    expect(model.getOverride('scaleType')).toBe('log')
  })

  it('flat keys not in configKeys pass through as plain model properties', () => {
    const model = TestModel.create({ name: 'myTrack' })
    expect(model.name).toBe('myTrack')
    expect(model.getOverride('name')).toBeUndefined()
  })

  it('stale configOverrides sub-key is stripped (not supported input format)', () => {
    // Any `configOverrides` key in the snapshot is ignored — only flat keys
    // declared in configKeys are collected.
    const model = TestModel.create({
      configOverrides: { color: 'red', scaleType: 'log' },
    })
    expect(model.getOverride('color')).toBeUndefined()
    expect(model.getOverride('scaleType')).toBeUndefined()
    expect(model.configOverrides).toEqual({})
  })

  it('full round-trip: save flat → reload flat', () => {
    const model1 = TestModel.create({})
    model1.setOverride('color', 'red')
    model1.setOverride('scaleType', 'log')
    const snap = getSnapshot(model1) as Record<string, unknown>
    expect(snap.color).toBe('red')
    expect(snap.scaleType).toBe('log')
    expect(snap).not.toHaveProperty('configOverrides')

    const model2 = TestModel.create(snap)
    expect(model2.getOverride('color')).toBe('red')
    expect(model2.getOverride('scaleType')).toBe('log')
  })
})

describe('ConfigOverrideMixin — composition with outer preProcessSnapshot', () => {
  it('outer migration runs first; its flat output is collected as an override', () => {
    const model = MigratingModel.create({ legacyColor: 'green' } as never)
    expect(model.getOverride('color')).toBe('green')
    const snap = getSnapshot(model) as Record<string, unknown>
    expect(snap.color).toBe('green')
    expect(snap).not.toHaveProperty('configOverrides')
    expect(snap).not.toHaveProperty('legacyColor')
  })

  it('flat displayMode is collected by ConfigOverrideMixin after migration', () => {
    const model = MigratingModel.create({ displayMode: 'compact' } as never)
    expect(model.getOverride('displayMode')).toBe('compact')
  })

  it('full round-trip: save flat → reload flat', () => {
    const model1 = MigratingModel.create({})
    model1.setOverride('color', 'red')
    model1.setOverride('displayMode', 'compact')
    const snap = getSnapshot(model1) as Record<string, unknown>
    expect(snap.color).toBe('red')
    expect(snap.displayMode).toBe('compact')
    expect(snap).not.toHaveProperty('configOverrides')

    const model2 = MigratingModel.create(snap)
    expect(model2.getOverride('color')).toBe('red')
    expect(model2.getOverride('displayMode')).toBe('compact')
  })
})

const TestConfigSchema = ConfigurationSchema('TestConfig', {
  color: { type: 'color', defaultValue: 'red' },
  tags: { type: 'stringArray', defaultValue: ['a', 'b'] },
})

const TestModelWithConfig = types.compose(
  'TestDisplayWithConfig',
  ConfigOverrideMixin(['color', 'tags']),
  types.model({
    configuration: types.optional(TestConfigSchema, {}),
  }),
)

describe('ConfigOverrideMixin — getConfWithOverride', () => {
  it('falls back to the config slot value when no override is set', () => {
    const model = TestModelWithConfig.create({})
    expect(model.getConfWithOverride('color')).toBe('red')
  })

  it('override wins over the config slot value', () => {
    const model = TestModelWithConfig.create({})
    model.setOverride('color', 'blue')
    expect(model.getConfWithOverride('color')).toBe('blue')
  })

  it('an array-typed slot is returned as a plain, cloneable array, not a live MST node', () => {
    const model = TestModelWithConfig.create({})
    const tags = model.getConfWithOverride('tags')
    expect(tags).toEqual(['a', 'b'])
    expect(isStateTreeNode(tags)).toBe(false)
    expect(() => structuredClone(tags)).not.toThrow()
  })

  it('an array-typed slot is referentially stable across reads when unchanged', () => {
    const model = TestModelWithConfig.create({})
    expect(model.getConfWithOverride('tags')).toBe(
      model.getConfWithOverride('tags'),
    )
  })
})

describe('migrateOldSettingSnapshots', () => {
  it('strips Setting suffix and promotes to flat keys', () => {
    const result = migrateOldSettingSnapshots({
      type: 'TestDisplay',
      colorSetting: 'red',
      scaleTypeSetting: 'log',
    })
    expect(result).toEqual({
      type: 'TestDisplay',
      color: 'red',
      scaleType: 'log',
    })
  })

  it('returns unchanged when no *Setting properties', () => {
    const snap = { type: 'TestDisplay', showCoverage: true }
    const result = migrateOldSettingSnapshots(snap)
    expect(result).toEqual(snap)
  })

  it('promotes alongside unrelated keys', () => {
    const result = migrateOldSettingSnapshots({
      type: 'TestDisplay',
      name: 'myTrack',
      colorSetting: 'blue',
    })
    expect(result).toEqual({
      type: 'TestDisplay',
      name: 'myTrack',
      color: 'blue',
    })
  })

  it('handles extraMappings for non-Setting properties', () => {
    const result = migrateOldSettingSnapshots(
      { trackMaxHeight: 800, colorSetting: 'red' },
      { trackMaxHeight: 'maxHeight' },
    )
    expect(result).toEqual({ maxHeight: 800, color: 'red' })
  })
})
