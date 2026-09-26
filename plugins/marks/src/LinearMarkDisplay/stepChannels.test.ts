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

test('a bin writing its edges as a pair fills nothing', () => {
  expect(stepChannels([{ type: 'bin', as: ['a', 'b'] }])).toEqual({})
})
