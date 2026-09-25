import configSchemaF from './configSchema.ts'
import { routeRetiredShorthand } from './retiredSettings.ts'
import stateModelFactory from './stateModel.ts'

const configSchema = configSchemaF()
const stateModel = stateModelFactory(configSchema)
const base = { type: 'LinearMafDisplay', displayId: 'm' }

describe('the retired domain slot on a MAF display config', () => {
  it('fails the load naming rows.domain', () => {
    expect(() => configSchema.create({ ...base, domain: ['mm10'] })).toThrow(
      /`domain` is `rows.domain`/,
    )
  })

  it('checks a bag of settings that names no type', () => {
    expect(() => configSchema.create({ domain: ['mm10'] })).toThrow(
      /`rows.domain`/,
    )
  })

  // A track's `displays` union asks every member whether an entry is its own
  // by running that member's preprocessor over it.
  it("leaves another display type's config alone", () => {
    expect(
      configSchema.is({
        type: 'LinearMultiSampleVariantDisplay',
        displayId: 'v',
        domain: ['a'],
      }),
    ).toBe(false)
  })
})

describe('the retired row-coloring slots on a MAF display config', () => {
  it.each([
    ['showTranslation', true, /`showTranslation` is `color: "codon"`/],
    ['colorByChromosome', true, /`colorByChromosome` is `color: "chromosome"`/],
    ['rowIdentityMode', 'xyplot', /`y: "identity"` for the X-Y plot/],
    ['mismatchRendering', false, /`color: "base"`/],
  ])('%s fails the load naming its replacement', (key, value, message) => {
    expect(() => configSchema.create({ ...base, [key]: value })).toThrow(
      message,
    )
  })
})

describe('the retired arrangement props on a MAF display snapshot', () => {
  it.each(['layout', 'clusterTree', 'clusterProvenance', 'subtreeFilter'])(
    '%s fails the load naming rows',
    key => {
      expect(() =>
        stateModel.create({
          type: 'LinearMafDisplay',
          configuration: configSchema.create(base),
          [key]: key === 'clusterTree' ? '(a,b);' : [],
        } as never),
      ).toThrow(new RegExp(`${key} on a LinearMafDisplay: .*\`rows\``))
    },
  )

  it("leave another display type's snapshot alone", () => {
    expect(
      stateModel.is({
        type: 'LinearMultiSampleVariantDisplay',
        subtreeFilter: ['a'],
      }),
    ).toBe(false)
  })
})

describe('displayDefaults.domain on a MAF track', () => {
  const track = { type: 'MafTrack', trackId: 'maf' }

  it('lands on an explicit MAF entry, where the refusal names rows.domain', () => {
    const routed = routeRetiredShorthand({
      ...track,
      displayDefaults: { domain: ['mm10'], rowHeight: 12 },
    }) as { displayDefaults: unknown; displays: Record<string, unknown>[] }
    expect(routed.displayDefaults).toEqual({ rowHeight: 12 })
    expect(routed.displays).toEqual([
      {
        type: 'LinearMafDisplay',
        displayId: 'maf-LinearMafDisplay',
        domain: ['mm10'],
      },
    ])
    expect(() => configSchema.create(routed.displays[0])).toThrow(
      /`rows.domain`/,
    )
  })

  it('joins an entry the config already spells', () => {
    const routed = routeRetiredShorthand({
      ...track,
      displayDefaults: { domain: ['mm10'] },
      displays: [{ ...base, rowHeight: 12 }],
    }) as { displays: unknown }
    expect(routed.displays).toEqual([
      { ...base, rowHeight: 12, domain: ['mm10'] },
    ])
  })

  it('leaves a track spelling rows alone', () => {
    const snap = { ...track, displayDefaults: { rows: { domain: ['mm10'] } } }
    expect(routeRetiredShorthand(snap)).toBe(snap)
  })
})
