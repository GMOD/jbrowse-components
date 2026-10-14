import { MATE_X2, stepChannels } from './stepChannels.ts'

test('coverage fills y with the field it writes', () => {
  expect(stepChannels([{ type: 'coverage' }])).toEqual({ y: 'coverage' })
  expect(stepChannels([{ type: 'coverage', as: 'depth' }])).toEqual({
    y: 'depth',
  })
})

test('an aggregate fills y only while it writes one summary', () => {
  expect(stepChannels([{ type: 'aggregate', ops: [{ op: 'count' }] }])).toEqual(
    { y: 'count' },
  )
  expect(
    stepChannels([
      { type: 'aggregate', ops: [{ op: 'mean', field: 'score', as: '' }] },
    ]),
  ).toEqual({ y: 'mean_score' })
  expect(
    stepChannels([
      { type: 'coverage' },
      { type: 'aggregate', ops: [{ op: 'count' }, { op: 'max', field: 'x' }] },
    ]),
  ).toEqual({})
})

test('a step making features anew clears the row and the far end before it', () => {
  expect(stepChannels([{ type: 'pileup' }, { type: 'mate' }])).toEqual({
    row: 'row',
    x2: MATE_X2,
  })
  expect(
    stepChannels([{ type: 'pileup', as: 'lane' }, { type: 'coverage' }]),
  ).toEqual({ y: 'coverage' })
  expect(
    stepChannels([{ type: 'coverage' }, { type: 'pileup', as: 'lane' }]),
  ).toEqual({ y: 'coverage', row: 'lane' })
})

test('a window keeps its features, so one summary fills y and the row stays', () => {
  expect(
    stepChannels([
      { type: 'pileup' },
      { type: 'window', ops: [{ op: 'mean', field: 'score', as: 'meth' }] },
    ]),
  ).toEqual({ row: 'row', y: 'meth' })
  expect(
    stepChannels([
      { type: 'coverage' },
      {
        type: 'window',
        ops: [
          { op: 'mean', field: 'coverage' },
          { op: 'max', field: 'x' },
        ],
      },
    ]),
  ).toEqual({ y: 'coverage' })
})

test('a bin writing its edges as a pair fills nothing', () => {
  expect(stepChannels([{ type: 'bin', as: ['a', 'b'] }])).toEqual({})
})

test('an aggregate keeps a channel only where it keeps every field it read', () => {
  const count = { op: 'count' as const }
  const grouped = (groupby: string[]) => ({
    type: 'aggregate',
    groupby,
    ops: [count],
  })
  expect(stepChannels([{ type: 'pileup' }, grouped(['row'])])).toEqual({
    y: 'count',
    row: 'row',
  })
  const mate = { type: 'mate' }
  expect(stepChannels([mate, grouped(['mate.refName'])]).x2).toBeUndefined()
  expect(
    stepChannels([mate, grouped(['mate.refName', 'mate.start'])]).x2,
  ).toEqual(MATE_X2)
})
