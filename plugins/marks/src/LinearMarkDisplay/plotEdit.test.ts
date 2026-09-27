import { withAggregateOp } from './plotEdit.ts'

test('a new aggregate op keeps the name its output is read by', () => {
  expect(
    withAggregateOp(
      {
        type: 'aggregate',
        ops: [
          { op: 'mean', field: 'score', as: 'avg' },
          { op: 'max', field: 'score' },
        ],
      },
      'sum',
      'score',
    ),
  ).toEqual({
    type: 'aggregate',
    ops: [
      { op: 'sum', field: 'score', as: 'avg' },
      { op: 'max', field: 'score' },
    ],
  })
  expect(
    withAggregateOp({ type: 'aggregate', ops: [] }, 'count', 'score'),
  ).toEqual({ type: 'aggregate', ops: [{ op: 'count' }] })
})
