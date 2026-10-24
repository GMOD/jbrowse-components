import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { preprocessTrackConfigSnapshot } from '@jbrowse/core/pluggableElementTypes/models'
import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'

import configSchemaFactory from '../LinearAlignmentsDisplay/configSchema.ts'
import AlignmentsPlugin from '../index.ts'
import {
  DEFAULT_BASES_FILTER,
  basesFilterOf,
  basesFilterProblems,
  contextEntries,
  withBasesField,
} from './basesFilter.ts'

const schema = configSchemaFactory(new PluginManager())

function create(snapshot: Record<string, unknown>) {
  return schema.create({
    type: 'LinearAlignmentsDisplay',
    displayId: 'd',
    ...snapshot,
  })
}

const basesFilterOfConf = (conf: ReturnType<typeof create>) =>
  predicatesOf(conf.pileup.bases.filter)

test('an unwritten field reads at its default', () => {
  expect(basesFilterOf([])).toEqual({
    probability: { min: 0.1, strict: false },
    context: 'CG',
  })
  expect(
    basesFilterOf([
      { field: 'probability', gte: 0.25 },
      { field: 'context', oneOf: ['CHH'] },
      { field: 'code', oneOf: ['a'] },
    ]),
  ).toEqual({
    probability: { min: 0.25, strict: false },
    context: 'CHH',
    codes: ['a'],
  })
})

test('a bare field drops its default', () => {
  expect(basesFilterOf([{ field: 'context' }]).context).toBe('all')
  expect(basesFilterOf([{ field: 'probability' }]).probability).toEqual({
    min: 0,
    strict: false,
  })
})

test('a probability floor written gt excludes the call at it', () => {
  expect(
    basesFilterOf([{ field: 'probability', gt: 0.5 }]).probability,
  ).toEqual({ min: 0.5, strict: true })
})

test('a floor at a call probability reaches the worker exactly', () => {
  const call = 149.5 / 256
  expect(
    basesFilterOf([{ field: 'probability', gte: call }]).probability.min,
  ).toBe(call)
})

test('a write at the default leaves the field unwritten', () => {
  expect(
    withBasesField([], 'probability', [{ field: 'probability', gte: 0.1 }]),
  ).toEqual([])
  expect(withBasesField([], 'context', contextEntries('CG'))).toEqual([])
  expect(withBasesField([], 'context', contextEntries('all'))).toEqual([
    { field: 'context' },
  ])
  expect(
    withBasesField(
      [{ field: 'probability', gte: 0.5 }],
      'probability',
      undefined,
    ),
  ).toEqual([])
  expect(basesFilterOf(withBasesField([], 'context', []))).toEqual({
    ...DEFAULT_BASES_FILTER,
    context: 'all',
  })
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

test("a v4 colorBy's modification settings land in the bases layer", () => {
  const conf = create({
    colorBy: {
      type: 'methylation',
      modifications: { threshold: 30, isolatedModification: 'm' },
    },
  })
  expect(basesFilterOfConf(conf)).toEqual([
    { field: 'probability', gte: 0.3 },
    { field: 'code', oneOf: ['m'] },
  ])
  expect(readConfObject(conf, ['pileup', 'bases', 'unmodified', 'show'])).toBe(
    true,
  )
})

test.each([
  ['all', true],
  ['calls', true],
  ['hidden', false],
])(
  "a beta modifications.unmodified '%s' lifts to pileup.bases.unmodified.show",
  (unmodified, show) => {
    const conf = create({ modifications: { unmodified } })
    expect(
      readConfObject(conf, ['pileup', 'bases', 'unmodified', 'show']),
    ).toBe(show)
  },
)

test('a beta modifications.unmodified reaches the display through displayDefaults', () => {
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
    displayDefaults: { modifications: { unmodified: 'all' } },
  })
  expect(warn).not.toHaveBeenCalled()
  warn.mockRestore()
  const display = (out.displays as Record<string, unknown>[]).find(
    d => d.type === 'LinearAlignmentsDisplay',
  )
  expect(
    readConfObject(create(display!), ['pileup', 'bases', 'unmodified', 'show']),
  ).toBe(true)
})
