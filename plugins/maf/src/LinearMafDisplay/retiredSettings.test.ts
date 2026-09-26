import PluginManager from '@jbrowse/core/PluginManager'
import { preprocessTrackConfigSnapshot } from '@jbrowse/core/pluggableElementTypes/models'

import MafPlugin from '../index.ts'
import configSchemaF from './configSchema.ts'
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
  const pluginManager = new PluginManager([new MafPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const load = (displayDefaults: Record<string, unknown>) =>
    preprocessTrackConfigSnapshot(pluginManager, {
      type: 'MafTrack',
      trackId: 'maf',
      assemblyNames: ['hg38'],
      adapter: { type: 'MafTabixAdapter', uri: 'x.maf.gz' },
      displayDefaults,
    })

  it('reaches the refusal that names rows.domain', () => {
    expect(() => load({ domain: ['mm10'], rowHeight: 12 })).toThrow(
      /`domain` is `rows.domain`/,
    )
  })

  it('leaves a track spelling rows alone', () => {
    expect(() => load({ rows: { domain: ['mm10'] } })).not.toThrow()
  })
})
