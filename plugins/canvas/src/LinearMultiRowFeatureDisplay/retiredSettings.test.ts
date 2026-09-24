import configSchemaF from './configSchema.ts'
import stateModelFactory from './model.ts'
import { routeRetiredShorthand } from './retiredSettings.ts'

const configSchema = configSchemaF()
const stateModel = stateModelFactory(configSchema)
const base = { type: 'LinearMultiRowFeatureDisplay', displayId: 't' }

describe('the retired settings on a multi-row display config', () => {
  it.each([
    ['partitionField', 'sample', /`partitionField` is `rows`/],
    ['domain', ['a'], /`domain` is `rows.domain`/],
    ['sampleColorMap', { a: 'red' }, /`sampleColorMap` is `rowColor/],
  ])('%s fails the load naming its replacement', (key, value, message) => {
    expect(() => configSchema.create({ ...base, [key]: value })).toThrow(
      message,
    )
  })

  it('checks a bag of settings that names no type', () => {
    expect(() => configSchema.create({ partitionField: 'sample' })).toThrow(
      /`rows`/,
    )
  })

  // A track's `displays` union asks every member whether an entry is its own
  // by running that member's preprocessor over it, so a MAF display's
  // `domain` reaches this one on the way to its own schema.
  it("leaves another display type's config alone", () => {
    expect(
      configSchema.is({
        type: 'LinearMafDisplay',
        displayId: 'm',
        domain: ['a'],
      }),
    ).toBe(false)
  })
})

describe('the retired arrangement props on a multi-row display snapshot', () => {
  it('fail the load naming rows', () => {
    expect(() =>
      stateModel.create({
        type: 'LinearMultiRowFeatureDisplay',
        configuration: configSchema.create(base),
        layout: [{ name: 'a' }],
      } as never),
    ).toThrow(/layout on a LinearMultiRowFeatureDisplay: .*`rows`/)
  })

  it("leave another display type's snapshot alone", () => {
    expect(
      stateModel.is({ type: 'LinearMafDisplay', subtreeFilter: ['a'] }),
    ).toBe(false)
  })
})

describe('displayDefaults spelling a retired setting on a feature track', () => {
  const track = { type: 'FeatureTrack', trackId: 'f' }

  it('lands on an explicit multi-row entry, where the refusal names rows', () => {
    const routed = routeRetiredShorthand({
      ...track,
      displayDefaults: { partitionField: 'sample', height: 90 },
    }) as { displayDefaults: unknown; displays: Record<string, unknown>[] }
    expect(routed.displayDefaults).toEqual({ height: 90 })
    expect(routed.displays).toEqual([
      {
        type: 'LinearMultiRowFeatureDisplay',
        displayId: 'f-LinearMultiRowFeatureDisplay',
        partitionField: 'sample',
      },
    ])
    expect(() => configSchema.create(routed.displays[0])).toThrow(/`rows`/)
  })

  it('joins an entry the config already spells', () => {
    const routed = routeRetiredShorthand({
      ...track,
      displayDefaults: { sampleColorMap: { a: 'red' } },
      displays: [{ ...base, height: 50 }],
    }) as { displays: unknown }
    expect(routed.displays).toEqual([
      { ...base, height: 50, sampleColorMap: { a: 'red' } },
    ])
  })

  it('leaves a track spelling rows alone', () => {
    const snap = { ...track, displayDefaults: { rows: 'sample' } }
    expect(routeRetiredShorthand(snap)).toBe(snap)
  })
})
