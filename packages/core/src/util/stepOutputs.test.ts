import { STEP_OUTPUTS, stepsOutput } from './stepOutputs.ts'

import type { TransformStep } from './markEncodingTypes.ts'
import type { StepType } from './stepOutputs.ts'

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const everyStepHasAnEntry: Same<StepType, TransformStep['type']> = true

test('the table names every step type the worker runs', () => {
  expect(everyStepHasAnEntry).toBe(true)
  expect(Object.keys(STEP_OUTPUTS).sort()).toHaveLength(10)
})

test('an empty as writes the default name, as the worker does', () => {
  const { surviving, channels } = stepsOutput([
    { type: 'coverage' },
    { type: 'formula', as: '' },
    { type: 'pileup', as: '' },
  ])
  expect([...surviving!]).toEqual(
    expect.arrayContaining(['coverage', 'value', 'row']),
  )
  expect(channels.get('row')).toBe('row')
})

test('an aggregate keeps a channel whose field it groups by', () => {
  const pileup = { type: 'pileup' }
  const grouped = stepsOutput([
    pileup,
    { type: 'aggregate', groupby: ['row'], ops: [{ op: 'count' }] },
  ])
  expect(Object.fromEntries(grouped.channels)).toEqual({
    row: 'row',
    y: 'count',
  })
  const folded = stepsOutput([pileup, { type: 'aggregate', ops: [] }])
  expect(folded.channels.size).toBe(0)
})

test('an aggregate behind a bin keeps the edges the bin wrote', () => {
  const { surviving } = stepsOutput([
    { type: 'bin', as: ['lo', 'hi'] },
    { type: 'aggregate', ops: [{ op: 'mean', field: 'score' }] },
  ])
  expect([...surviving!].sort()).toEqual(
    ['end', 'hi', 'lo', 'mean_score', 'refName', 'start'].sort(),
  )
})

test('a field a group keeps holds the kind an earlier step wrote', () => {
  const { written } = stepsOutput([
    { type: 'cells' },
    { type: 'aggregate', groupby: ['state'], ops: [{ op: 'count' }] },
  ])
  expect(written.find(w => w.field === 'state')?.kind).toBe('categorical')
})
