import PluginManager from '@jbrowse/core/PluginManager'
import { preprocessTrackConfigSnapshot } from '@jbrowse/core/pluggableElementTypes/models'
import LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

import CanvasPlugin from '../index.ts'
import configSchemaF from './configSchema.ts'
import stateModelFactory from './model.ts'

const configSchema = configSchemaF()
const stateModel = stateModelFactory(configSchema)
const base = { type: 'LinearMultiRowFeatureDisplay', displayId: 't' }

describe('the retired settings on a multi-row display config', () => {
  it.each([
    ['partitionField', 'sample', /`partitionField` is `rows`/],
    ['domain', ['a'], /`domain` is `rows.domain`/],
    ['sampleColorMap', { a: 'red' }, /`sampleColorMap` is `rowColor/],
    [
      'legend',
      [{ label: 'Maternal', color: 'red' }],
      /`legend` is `color: \{ scale: "identity"/,
    ],
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
  const pluginManager = new PluginManager([
    new LinearGenomeViewPlugin(),
    new CanvasPlugin(),
  ])
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const load = (displayDefaults: Record<string, unknown>) =>
    preprocessTrackConfigSnapshot(pluginManager, {
      type: 'FeatureTrack',
      trackId: 'f',
      assemblyNames: ['hg38'],
      adapter: { type: 'BedTabixAdapter', uri: 'x.bed.gz' },
      displayDefaults,
    })

  it('reaches the refusal that names rows', () => {
    expect(() => load({ partitionField: 'sample', height: 90 })).toThrow(
      /`partitionField` is `rows`/,
    )
  })

  it('leaves a track spelling rows alone', () => {
    expect(() => load({ rows: 'sample' })).not.toThrow()
  })
})
