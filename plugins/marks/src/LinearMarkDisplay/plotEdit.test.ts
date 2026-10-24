import { withChannel } from './markEdit.ts'
import { stepFields, withAggregateOp, withSplitField } from './plotEdit.ts'

import type { MarkPlot } from './markPlot.ts'

test('a text field a step writes is picked as a category, a number as a ramp', () => {
  const fields = stepFields({ numeric: ['state'], categorical: [] }, [
    { type: 'flatten', field: 'alignments', key: 'species' },
    { type: 'cells' },
    { type: 'mate' },
  ])
  const scaleOf = (field: string) =>
    (
      withChannel({ mark: 'rect' }, 'color', field, fields).encoding?.color as {
        scale?: { type?: string }
      }
    ).scale?.type
  expect(scaleOf('species')).toBe('ordinal')
  expect(scaleOf('state')).toBe('ordinal')
  expect(scaleOf('svType')).toBe('ordinal')
  expect(scaleOf('match')).toBe('linear')
  expect(scaleOf('mate.start')).toBe('linear')
  expect(fields.numeric).not.toContain('start')
})

test('the picker offers what survives an aggregate, and the edges a bin renamed', () => {
  const scanned = { numeric: ['score'], categorical: ['strand'] }
  const binned = [{ type: 'bin' as const, as: ['lo', 'hi'] }]
  expect(stepFields(scanned, binned).numeric).toEqual(['score', 'lo', 'hi'])
  const counted = stepFields(scanned, [
    ...binned,
    { type: 'aggregate', ops: [{ op: 'count' }] },
  ])
  expect(counted.numeric).toEqual(['lo', 'hi', 'count'])
  expect(counted.categorical).toEqual([])
  const grouped = stepFields(scanned, [
    { type: 'aggregate', groupby: ['strand'], ops: [{ op: 'count' }] },
  ])
  expect(grouped.categorical).toEqual(['strand'])
})

test("a formula's field is offered as what its expression answers", () => {
  const scanned = { numeric: ['score'], categorical: ['type'] }
  const kinds = (expr: string) => {
    const fields = stepFields(scanned, [{ type: 'formula', expr, as: 'out' }])
    return [fields.numeric.includes('out'), fields.categorical.includes('out')]
  }
  expect(kinds('jexl:feature.score * 2')).toEqual([true, false])
  expect(kinds("jexl:feature.type + '!'")).toEqual([false, true])
  expect(kinds('jexl:feature.score > 10')).toEqual([false, true])
  expect(kinds("jexl:feature.score > 10 ? 'high' : 'low'")).toEqual([
    false,
    true,
  ])
  expect(kinds('jexl:feature.score')).toEqual([true, false])
  const overwritten = stepFields(scanned, [
    { type: 'formula', expr: "jexl:feature.type + '!'", as: 'count' },
    { type: 'aggregate', ops: [{ op: 'count' }] },
  ])
  expect(overwritten.numeric).toContain('count')
})

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
