import {
  ConfigurationSchema,
  applyConfSettings,
} from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import {
  normalInsertSizeConfigSchema,
  normalInsertSizeProblems,
  pinnedInsertSizeBandOf,
} from './normalInsertSizeConfigSchema.ts'

const conf = (snap: { min?: number; max?: number }) =>
  normalInsertSizeConfigSchema.create(snap)

test('both ends pin the band', () => {
  expect(pinnedInsertSizeBandOf(conf({ min: 150, max: 600 }))).toEqual({
    lower: 150,
    upper: 600,
  })
  expect(normalInsertSizeProblems(conf({ min: 150, max: 600 }))).toEqual([])
})

test('unset is the sampled band, and says nothing', () => {
  expect(pinnedInsertSizeBandOf(conf({}))).toBeUndefined()
  expect(normalInsertSizeProblems(conf({}))).toEqual([])
})

test('one end, or ends out of order, pin nothing and are named', () => {
  for (const snap of [{ min: 150 }, { max: 600 }, { min: 600, max: 150 }]) {
    expect(pinnedInsertSizeBandOf(conf(snap))).toBeUndefined()
    expect(normalInsertSizeProblems(conf(snap))).toEqual([
      expect.stringMatching(/^normalInsertSize: /),
    ])
  }
})

test('a misspelt end refuses the bag before the other end is written', () => {
  const holder = ConfigurationSchema('InsertSizeHolder', {
    normalInsertSize: normalInsertSizeConfigSchema,
  }).create()
  const report = applyConfSettings(holder, {
    normalInsertSize: { min: 150, mxa: 600 },
  })
  expect(report.applied).toEqual([])
  expect(report.failed).toEqual([
    {
      key: 'normalInsertSize',
      error: expect.stringContaining(
        'NormalInsertSize takes min and max, not mxa',
      ),
    },
  ])
  expect(getSnapshot(holder)).toEqual({})
})
