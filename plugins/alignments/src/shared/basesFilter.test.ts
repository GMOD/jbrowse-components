import PluginManager from '@jbrowse/core/PluginManager'
import {
  applyConfSettings,
  getConfigurationSchemaMetadata,
  liftRetiredSpellings,
  readConfObject,
} from '@jbrowse/core/configuration'
import { preprocessTrackConfigSnapshot } from '@jbrowse/core/pluggableElementTypes/models'
import { mergeTrackConfig } from '@jbrowse/core/util'
import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import configSchemaFactory from '../LinearAlignmentsDisplay/configSchema.ts'
import AlignmentsPlugin from '../index.ts'
import {
  basesFilterOf,
  basesFilterProblems,
  modificationFiltersOf,
} from './basesFilter.ts'

const schema = configSchemaFactory(new PluginManager())
const meta = getConfigurationSchemaMetadata(schema)!

function create(snapshot: Record<string, unknown>) {
  return schema.create({
    type: 'LinearAlignmentsDisplay',
    displayId: 'd',
    ...snapshot,
  })
}

const basesFilterOfConf = (conf: ReturnType<typeof create>) =>
  predicatesOf(conf.pileup.bases.filter)

// A stored delta as SessionTracks merges it: lifted against the hydrated
// base, then merged over it
function overDelta(
  base: Record<string, unknown>,
  delta: Record<string, unknown>,
) {
  const hydrated = getSnapshot(create(base)) as Record<string, unknown>
  return create(
    mergeTrackConfig(
      hydrated,
      liftRetiredSpellings(meta, { displayId: 'd', ...delta }, hydrated),
    ),
  )
}

test('a bases filter states only the fields it names', () => {
  expect(modificationFiltersOf([])).toEqual({})
  expect(
    modificationFiltersOf([
      { field: 'probability', gte: 0.07 },
      { field: 'context', oneOf: ['CHH'] },
      { field: 'code', oneOf: ['a'] },
    ]),
  ).toEqual({ threshold: 7, cytosineContext: 'CHH', shownModifications: ['a'] })
  expect(modificationFiltersOf([{ field: 'context' }])).toEqual({
    cytosineContext: 'all',
  })
})

test('the settings round-trip, their defaults left unwritten', () => {
  const mods = {
    threshold: 35,
    cytosineContext: 'CHG' as const,
    shownModifications: ['m', 'h'],
  }
  expect(modificationFiltersOf(basesFilterOf(mods))).toEqual(mods)
  expect(basesFilterOf({ threshold: 10, cytosineContext: 'CG' })).toEqual([])
})

test('a probability floor written gt excludes the call at it', () => {
  expect(modificationFiltersOf([{ field: 'probability', gt: 0.5 }])).toEqual({
    threshold: 50,
    thresholdStrict: true,
  })
  expect(modificationFiltersOf([{ field: 'probability', gte: 0.5 }])).toEqual({
    threshold: 50,
  })
  expect(basesFilterOf({ threshold: 50, thresholdStrict: true })).toEqual([
    { field: 'probability', gt: 0.5 },
  ])
})

test('a test the per-base layer cannot apply is named', () => {
  expect(
    basesFilterProblems([
      { field: 'probability', gte: 0.5 },
      { field: 'context', oneOf: ['CHG'] },
      { field: 'context', equal: 'CHG' },
      { field: 'code', oneOf: ['m'] },
    ]),
  ).toEqual([])
  expect(basesFilterProblems([{ field: 'probability', gte: 50 }])).toEqual([
    'pileup.bases.filter: probability runs from 0 to 1, not {"field":"probability","gte":50}',
  ])
  expect(basesFilterProblems([{ field: 'probability', lte: 0.5 }])).toEqual([
    'pileup.bases.filter: probability takes gte or gt, not {"field":"probability","lte":0.5}',
  ])
  expect(
    basesFilterProblems([{ field: 'context', oneOf: ['CG', 'CHG'] }]),
  ).toEqual([
    'pileup.bases.filter: context takes one of CG, CHG, CHH, or none to take all three, not ["CG","CHG"]',
  ])
  expect(basesFilterProblems([{ field: 'mapq', gte: 1 }])).toEqual([
    'pileup.bases.filter: no field "mapq"; it takes probability, context, code',
  ])
})

test('beta modifications thresholds lift into pileup.bases.filter', () => {
  const conf = create({
    modifications: {
      threshold: 50,
      cytosineContext: 'CHG',
      shownModifications: ['a'],
      unmodified: 'all',
    },
  })
  expect(basesFilterOfConf(conf)).toEqual([
    { field: 'probability', gte: 0.5 },
    { field: 'context', oneOf: ['CHG'] },
    { field: 'code', oneOf: ['a'] },
  ])
  expect(readConfObject(conf, ['modifications', 'unmodified'])).toBe('all')
})

test('a written bases filter beats a lifted beta threshold on its field', () => {
  expect(
    basesFilterOfConf(
      create({
        modifications: { threshold: 50, cytosineContext: 'CHG' },
        pileup: { bases: { filter: [{ field: 'probability', gte: 0.9 }] } },
      }),
    ),
  ).toEqual([
    { field: 'context', oneOf: ['CHG'] },
    { field: 'probability', gte: 0.9 },
  ])
})

test("a v4 colorBy's modification settings land in the bases filter", () => {
  expect(
    basesFilterOfConf(
      create({
        colorBy: {
          type: 'modifications',
          modifications: { threshold: 30, isolatedModification: 'm' },
        },
      }),
    ),
  ).toEqual([
    { field: 'probability', gte: 0.3 },
    { field: 'code', oneOf: ['m'] },
  ])
})

describe('a stored beta delta over the hydrated base', () => {
  test('a threshold beats the base probability', () => {
    const conf = overDelta(
      { pileup: { bases: { filter: [{ field: 'probability', gte: 0.5 }] } } },
      { modifications: { threshold: 30 } },
    )
    expect(basesFilterOfConf(conf)).toEqual([
      { field: 'probability', gte: 0.3 },
    ])
  })

  test('a null threshold resets the old-spelled base to the default', () => {
    const conf = overDelta(
      { modifications: { threshold: 50, cytosineContext: 'CHG' } },
      { modifications: { threshold: null } },
    )
    expect(basesFilterOfConf(conf)).toEqual([
      { field: 'context', oneOf: ['CHG'] },
    ])
  })

  test('a context replaces the old-spelled base context and keeps the rest', () => {
    const conf = overDelta(
      { modifications: { threshold: 50, cytosineContext: 'CHG' } },
      { modifications: { cytosineContext: 'CHH' } },
    )
    expect(basesFilterOfConf(conf)).toEqual([
      { field: 'probability', gte: 0.5 },
      { field: 'context', oneOf: ['CHH'] },
    ])
  })
})

test('a beta modifications member reaches the display through displayDefaults', () => {
  const pluginManager = new PluginManager([new AlignmentsPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const out = preprocessTrackConfigSnapshot(pluginManager, {
    type: 'AlignmentsTrack',
    trackId: 't',
    name: 't',
    assemblyNames: ['volvox'],
    adapter: { type: 'BamAdapter', uri: 'a.bam' },
    displayDefaults: { modifications: { threshold: 50, unmodified: 'all' } },
  })
  expect(warn).not.toHaveBeenCalled()
  warn.mockRestore()
  const display = (out.displays as Record<string, unknown>[]).find(
    d => d.type === 'LinearAlignmentsDisplay',
  )
  expect(basesFilterOfConf(create(display!))).toEqual([
    { field: 'probability', gte: 0.5 },
  ])
  expect(
    readConfObject(create(display!), ['modifications', 'unmodified']),
  ).toBe('all')
})

test('a beta member in a settings bag lands over the live config', () => {
  const conf = create({
    pileup: {
      bases: {
        filter: [
          { field: 'probability', gte: 0.5 },
          { field: 'context', oneOf: ['CHG'] },
        ],
      },
    },
  })
  applyConfSettings(conf, { modifications: { threshold: null } })
  expect(basesFilterOfConf(conf)).toEqual([
    { field: 'context', oneOf: ['CHG'] },
  ])
  applyConfSettings(conf, { modifications: { threshold: 30 } })
  expect(basesFilterOfConf(conf)).toEqual([
    { field: 'context', oneOf: ['CHG'] },
    { field: 'probability', gte: 0.3 },
  ])
})
