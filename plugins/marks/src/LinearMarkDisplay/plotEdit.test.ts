import { withAggregateOp, withSplitField } from './plotEdit.ts'

import type { MarkPlot } from './markPlot.ts'

test('a split field retyped through empty keeps the order and the steps the setting held', () => {
  const facet = {
    field: 'HP',
    domain: ['1', '2'],
    transform: [{ type: 'pileup' }],
  }
  let plot: MarkPlot = { marks: [], facet }
  for (const text of ['H', '', 'P', 'PS']) {
    plot = withSplitField(plot, 'facet', text, facet)
  }
  expect(plot.facet).toEqual({ ...facet, field: 'PS' })
  expect(withSplitField({ marks: [], facet }, 'facet', '').facet).toBeNull()
})

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
