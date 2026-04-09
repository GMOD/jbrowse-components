import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import ConfigOverrideMixin, {
  migrateOldSettingSnapshots,
} from './ConfigOverrideMixin.ts'

const TestModel = types.compose(
  'TestDisplay',
  ConfigOverrideMixin(),
  types.model({ name: types.optional(types.string, 'test') }),
)

describe('ConfigOverrideMixin', () => {
  it('starts with empty overrides', () => {
    const model = TestModel.create({})
    expect(model.configOverrides).toEqual({})
  })

  it('setOverride stores a value', () => {
    const model = TestModel.create({})
    model.setOverride('color', 'red')
    expect(model.getOverride('color')).toBe('red')
  })

  it('getOverride returns undefined for missing keys', () => {
    const model = TestModel.create({})
    expect(model.getOverride('missing')).toBeUndefined()
  })

  it('clearOverride removes a value', () => {
    const model = TestModel.create({})
    model.setOverride('color', 'red')
    model.clearOverride('color')
    expect(model.getOverride('color')).toBeUndefined()
  })

  it('postProcessSnapshot strips empty configOverrides', () => {
    const model = TestModel.create({})
    const snap = getSnapshot(model)
    expect(snap).not.toHaveProperty('configOverrides')
  })

  it('postProcessSnapshot keeps non-empty configOverrides', () => {
    const model = TestModel.create({ configOverrides: { color: 'red' } })
    const snap = getSnapshot(model)
    expect(snap.configOverrides).toEqual({ color: 'red' })
  })

  it('hydrates from existing configOverrides snapshot', () => {
    const model = TestModel.create({
      configOverrides: { scaleType: 'log', minScore: 0 },
    })
    expect(model.getOverride('scaleType')).toBe('log')
    expect(model.getOverride('minScore')).toBe(0)
  })

  it('multiple overrides accumulate', () => {
    const model = TestModel.create({})
    model.setOverride('color', 'red')
    model.setOverride('scaleType', 'log')
    model.setOverride('minScore', 5)
    expect(model.configOverrides).toEqual({
      color: 'red',
      scaleType: 'log',
      minScore: 5,
    })
  })

  it('setOverride replaces existing value', () => {
    const model = TestModel.create({})
    model.setOverride('color', 'red')
    model.setOverride('color', 'blue')
    expect(model.getOverride('color')).toBe('blue')
  })
})

describe('migrateOldSettingSnapshots', () => {
  it('strips Setting suffix and moves to configOverrides', () => {
    const result = migrateOldSettingSnapshots({
      type: 'TestDisplay',
      colorSetting: 'red',
      scaleTypeSetting: 'log',
    })
    expect(result).toEqual({
      type: 'TestDisplay',
      configOverrides: { color: 'red', scaleType: 'log' },
    })
  })

  it('returns unchanged when no *Setting properties', () => {
    const snap = { type: 'TestDisplay', showCoverage: true }
    const result = migrateOldSettingSnapshots(snap)
    expect(result).toEqual(snap)
  })

  it('merges with existing configOverrides', () => {
    const result = migrateOldSettingSnapshots({
      configOverrides: { existing: true },
      colorSetting: 'blue',
    })
    expect(result).toEqual({
      configOverrides: { existing: true, color: 'blue' },
    })
  })

  it('handles extraMappings for non-Setting properties', () => {
    const result = migrateOldSettingSnapshots(
      { trackMaxHeight: 800, colorSetting: 'red' },
      { trackMaxHeight: 'maxHeight' },
    )
    expect(result).toEqual({
      configOverrides: { maxHeight: 800, color: 'red' },
    })
  })
})
