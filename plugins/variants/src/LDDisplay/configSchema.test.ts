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

const COLOR = ['encoding', 'color'] as const

function make(snap: Record<string, unknown> = {}) {
  return ldTrackDisplayConfigSchema().create({
    type: 'LDTrackDisplay',
    displayId: 'ld-test',
    ...snap,
  })
}

test('keeps what its mixins read, and its identifier', () => {
  expect(slots()).toEqual(
    expect.arrayContaining(['height', 'legend', 'heightMode']),
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

describe('encoding.color', () => {
  test('a bare string names the field, as every color channel reads one', () => {
    expect(
      readConfObject(make({ encoding: { color: 'dprime' } }), [
        ...COLOR,
        'field',
      ]),
    ).toBe('dprime')
  })

  test('unset, it maps r2 through a linear ramp with no scheme written', () => {
    const conf = make()
    expect(readConfObject(conf, [...COLOR, 'field'])).toBe('r2')
    expect(readConfObject(conf, [...COLOR, 'scale', 'type'])).toBeUndefined()
    expect(readConfObject(conf, [...COLOR, 'scale', 'scheme'])).toBeUndefined()
    expect(readConfObject(conf, [...COLOR, 'scale', 'reverse'])).toBeUndefined()
  })

  test.each([
    ['r2', 'reds', 'R²'],
    ['dprime', 'blues', "D'"],
  ])('%s presets a linear %s ramp keyed %s', (field, scheme, title) => {
    expect(fieldScaleOf(LD_FIELD_PRESETS, field)).toBe('linear')
    expect(presetOf(LD_FIELD_PRESETS, field)).toMatchObject({
      scale: { scheme },
      legend: { title },
    })
  })

  test.each([
    { scale: { scheme: 'viridis', domainMax: 0.8 } },
    {
      field: 'dprime',
      scale: { scheme: 'magma', reverse: false, domainMin: 0.2 },
    },
  ])('a config written today reads back unchanged: %j', color => {
    expect(plotOf(make({ encoding: { color } }))).toEqual({
      encoding: { color },
    })
  })

  test('a field alone reads back as its shorthand', () => {
    expect(plotOf(make({ encoding: { color: { field: 'dprime' } } }))).toEqual({
      encoding: { color: 'dprime' },
    })
  })

  test('a default color reads back as no plot', () => {
    expect(plotOf(make())).toEqual({})
  })

  test('maps r2 and dprime and nothing else', () => {
    expect(() => make({ encoding: { color: { field: 'score' } } })).toThrow()
  })

  test('a write refuses a member it does not declare', () => {
    expect(() =>
      refusingUndeclaredKeys(() =>
        make({ encoding: { color: { scale: { domainQuantile: 0.95 } } } }),
      ),
    ).toThrow(/domainQuantile/)
    expect(() =>
      refusingUndeclaredKeys(() =>
        make({ encoding: { color: { value: 'red' } } }),
      ),
    ).toThrow(/value/)
  })
})

describe('labels.name', () => {
  test('draws no names unset', () => {
    expect(readConfObject(make(), ['labels', 'name', 'show'])).toBe(false)
  })

  // a boolean on LDTrackDisplay through v4.3.0, then 'name' | 'none'
  test.each([
    [true, true],
    [false, false],
    ['name', true],
    ['none', false],
  ])('lifts the old showLabels %j', (old, shown) => {
    expect(
      readConfObject(make({ showLabels: old }), ['labels', 'name', 'show']),
    ).toBe(shown)
  })
})

// `ldMetric` shipped on LDTrackDisplay from v4.1.1 to v4.3.0.
describe('the v4 ldMetric', () => {
  test('lifts into encoding.color.field', () => {
    const conf = make({ ldMetric: 'dprime' })
    expect(readConfObject(conf, [...COLOR, 'field'])).toBe('dprime')
    expect(getSnapshot(conf)).not.toHaveProperty('ldMetric')
  })

  test('lands beside a color the entry writes, which wins', () => {
    const conf = make({
      ldMetric: 'dprime',
      encoding: { color: { scale: { scheme: 'viridis' } } },
    })
    expect(plotOf(conf)).toEqual({
      encoding: { color: { field: 'dprime', scale: { scheme: 'viridis' } } },
    })
    const written = make({
      ldMetric: 'dprime',
      encoding: { color: { field: 'r2' } },
    })
    expect(readConfObject(written, [...COLOR, 'field'])).toBe('r2')
  })
})

// `showLegend` shipped on LDTrackDisplay through v4.3.0, default off.
describe('the v4 showLegend', () => {
  test('lifts into legend.show', () => {
    const conf = make({ showLegend: true })
    expect(readConfObject(conf, ['legend', 'show'])).toBe(true)
    expect(getSnapshot(conf)).not.toHaveProperty('showLegend')
  })

  test('the legend is off unset', () => {
    expect(readConfObject(make(), ['legend', 'show'])).toBe(false)
  })
})
