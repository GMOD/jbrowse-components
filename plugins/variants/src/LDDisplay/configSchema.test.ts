import {
  getConfigurationSchemaDefinition,
  plotOf,
  readConfObject,
  refusingUndeclaredKeys,
} from '@jbrowse/core/configuration'
import { fieldScaleOf, presetOf } from '@jbrowse/core/util/colorScale'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import ldTrackDisplayConfigSchema from './configSchemaLDTrack.ts'
import { LD_FIELD_PRESETS } from './ldColorConfigSchema.ts'

const slots = () =>
  Object.keys(getConfigurationSchemaDefinition(ldTrackDisplayConfigSchema())!)

function make(snap: Record<string, unknown> = {}) {
  return ldTrackDisplayConfigSchema().create({
    type: 'LDTrackDisplay',
    displayId: 'ld-test',
    ...snap,
  })
}

test('keeps what its mixins read, and its identifier', () => {
  expect(slots()).toEqual(
    expect.arrayContaining(['height', 'showLegend', 'squashToHeight']),
  )
  expect(make().displayId).toBe('ld-test')
})

// An LD file serves no features and the display takes no byte gate.
test.each(['mouseover', 'fetchSizeLimit', 'forceLoad'])(
  'publishes no %s slot, which it never reads',
  slot => {
    expect(slots()).not.toContain(slot)
  },
)

describe('color', () => {
  test('a bare string names the field, as every colour object reads one', () => {
    expect(readConfObject(make({ color: 'dprime' }), ['color', 'field'])).toBe(
      'dprime',
    )
  })

  test('unset, it maps r2 through a linear ramp with no scheme written', () => {
    const conf = make()
    expect(readConfObject(conf, ['color', 'field'])).toBe('r2')
    expect(readConfObject(conf, ['color', 'scale'])).toBeUndefined()
    expect(readConfObject(conf, ['color', 'scheme'])).toBeUndefined()
    expect(readConfObject(conf, ['color', 'reverse'])).toBeUndefined()
  })

  test.each([
    ['r2', 'reds', 'R²'],
    ['dprime', 'blues', "D'"],
  ])('%s presets a linear %s ramp keyed %s', (field, scheme, title) => {
    expect(fieldScaleOf(LD_FIELD_PRESETS, field)).toBe('linear')
    expect(presetOf(LD_FIELD_PRESETS, field)).toMatchObject({ scheme, title })
  })

  test.each([
    { scheme: 'viridis', domainMax: 0.8 },
    { field: 'dprime', scheme: 'magma', reverse: false, domainMin: 0.2 },
  ])('a config written today reads back unchanged: %j', color => {
    expect(plotOf(make({ color }))).toEqual({ color })
  })

  test('a field alone reads back as its shorthand', () => {
    expect(plotOf(make({ color: { field: 'dprime' } }))).toEqual({
      color: 'dprime',
    })
  })

  test('a default colour reads back as no plot', () => {
    expect(plotOf(make())).toEqual({})
  })

  test('maps r2 and dprime and nothing else', () => {
    expect(() => make({ color: { field: 'score' } })).toThrow()
  })

  test('a write refuses a member it does not declare', () => {
    expect(() =>
      refusingUndeclaredKeys(() => make({ color: { domainQuantile: 0.95 } })),
    ).toThrow(/domainQuantile/)
    expect(() =>
      refusingUndeclaredKeys(() => make({ color: { value: 'red' } })),
    ).toThrow(/value/)
  })
})

describe('showLabels', () => {
  test('takes the two label modes the display draws, and none unset', () => {
    expect(readConfObject(make(), 'showLabels')).toBe('none')
    expect(readConfObject(make({ showLabels: 'name' }), 'showLabels')).toBe(
      'name',
    )
    expect(() => make({ showLabels: 'auto' })).toThrow()
  })

  // a boolean on LDTrackDisplay through v4.3.0
  test.each([
    [true, 'name'],
    [false, 'none'],
  ])('lifts the v4 %s to %s', (v4, mode) => {
    expect(readConfObject(make({ showLabels: v4 }), 'showLabels')).toBe(mode)
  })
})

// `ldMetric` shipped on LDTrackDisplay from v4.1.1 to v4.3.0.
describe('the v4 ldMetric', () => {
  test('lifts into color.field', () => {
    const conf = make({ ldMetric: 'dprime' })
    expect(readConfObject(conf, ['color', 'field'])).toBe('dprime')
    expect(getSnapshot(conf)).not.toHaveProperty('ldMetric')
  })

  test('lands beside a color the entry writes, which wins', () => {
    const conf = make({ ldMetric: 'dprime', color: { scheme: 'viridis' } })
    expect(plotOf(conf)).toEqual({
      color: { field: 'dprime', scheme: 'viridis' },
    })
    const written = make({ ldMetric: 'dprime', color: { field: 'r2' } })
    expect(readConfObject(written, ['color', 'field'])).toBe('r2')
  })
})
