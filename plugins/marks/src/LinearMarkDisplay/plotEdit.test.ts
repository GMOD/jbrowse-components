import { plotOf, plotWrites, setConf } from '@jbrowse/core/configuration'
import createJexlInstance from '@jbrowse/core/util/jexl'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { configSchemaFactory } from './configSchema.ts'
import { withChannel } from './markEdit.ts'
import {
  splitOrder,
  stepFields,
  withAggregateOp,
  withSplitField,
  withSplitOrder,
} from './plotEdit.ts'

import type { MarkPlot } from './markPlot.ts'
import type { Signature } from '@jbrowse/core/util/jexl'

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

test('a formula calling a function is offered as what the function returns', () => {
  const scanned = { numeric: ['score'], categorical: ['type'] }
  const functions = createJexlInstance().signatures()
  const kinds = (
    expr: string,
    given: Readonly<Record<string, Signature>> | undefined,
  ) => {
    const fields = stepFields(
      scanned,
      [{ type: 'formula', expr, as: 'out' }],
      given,
    )
    return [fields.numeric.includes('out'), fields.categorical.includes('out')]
  }
  expect(kinds('jexl:toUpperCase(feature.type)', functions)).toEqual([
    false,
    true,
  ])
  expect(kinds("jexl:split(feature.name, '.')[0]", functions)).toEqual([
    false,
    true,
  ])
  expect(kinds('jexl:-log10(feature.score)', functions)).toEqual([true, false])
  // without the signatures a call answers nothing known, and a formula's
  // field stays the number it is by default
  expect(kinds('jexl:toUpperCase(feature.type)', undefined)).toEqual([
    true,
    false,
  ])
})

describe('the split field, typed a keystroke at a time', () => {
  const facet = {
    field: 'HP',
    sort: ['1', '2'],
    hidden: ['2'],
    transform: [{ type: 'pileup' }],
  }
  const typed = (base: MarkPlot, key: 'facet' | 'rows', texts: string[]) =>
    texts.reduce((plot, text) => withSplitField(plot, key, text, base), base)
  const retype = (key: 'facet' | 'rows', setting: object, texts: string[]) =>
    typed({ marks: [], [key]: setting }, key, texts)[key]

  test('retyped back to its field through empty, the facet keeps everything', () => {
    expect(retype('facet', facet, ['H', '', 'H', 'HP'])).toBe(facet)
  })

  test('another field drops the sections and keeps the steps', () => {
    expect(retype('facet', facet, ['H', '', 'P', 'PS'])).toEqual({
      field: 'PS',
      transform: [{ type: 'pileup' }],
    })
  })

  test('another rows field drops the arrangement, which names the old values', () => {
    const rows = {
      field: 'HP',
      sort: ['2', '1'],
      labels: { 1: 'Maternal' },
      tree: '(1,2);',
      kept: ['1'],
    }
    expect(retype('rows', rows, ['H', 'HP'])).toBe(rows)
    expect(retype('rows', rows, ['P', 'PS'])).toEqual({ field: 'PS' })
  })

  // The keyed rule: the pins name the old field's rows, and the color
  // channel names an attribute, valid on the new rows.
  test('another rows field drops the pinned row colors and keeps rows.color', () => {
    const base: MarkPlot = {
      marks: [],
      rows: {
        field: 'HP',
        colors: { 1: '#f00' },
        color: { field: 'group', scale: { unknown: '' } },
      },
    }
    expect(typed(base, 'rows', ['P', 'PS']).rows).toEqual({
      field: 'PS',
      color: { field: 'group', scale: { unknown: '' } },
    })
    expect(typed(base, 'rows', ['H', '', 'HP']).rows).toBe(base.rows)
  })

  test('an empty field clears the setting', () => {
    expect(withSplitField({ marks: [], facet }, 'facet', '').facet).toBeNull()
  })
})

test('emptying the rows field keeps the row axis and the arrangement', () => {
  const rows = {
    field: 'sample',
    sort: ['b', 'a'],
    labels: { a: 'A' },
    axis: { grid: true },
  }
  expect(withSplitField({ marks: [], rows }, 'rows', '').rows).toEqual({
    sort: ['b', 'a'],
    labels: { a: 'A' },
    axis: { grid: true },
  })
  expect(
    withSplitField({ marks: [], rows: { field: 'sample' } }, 'rows', '').rows,
  ).toBeNull()
})

test('emptying the rows field in the box writes what the JSON text does', () => {
  const arrangement = {
    sort: ['b', 'a'],
    labels: { a: 'A' },
    axis: { grid: true },
  }
  const written = (edit: (plot: MarkPlot) => MarkPlot) => {
    const conf = configSchemaFactory().create({
      type: 'LinearMarkDisplay',
      displayId: 'emptied',
      rows: { field: 'source', ...arrangement },
    })
    const writes = plotWrites(conf, edit(plotOf(conf)), { whole: true })
    expect(Object.keys(writes)).toEqual(['rows'])
    setConf(conf, 'rows', writes.rows)
    return getSnapshot(conf.rows)
  }
  const box = written(plot => withSplitField(plot, 'rows', ''))
  const text = written(plot => ({
    ...plot,
    rows: { field: '', ...arrangement },
  }))
  expect(box).toEqual(text)
  expect(box).toEqual(arrangement)
})

test('the order box edits sort, and a rows order typed by hand drops the tree', () => {
  const rows = { field: 'HP', sort: ['1', '2'], tree: '(1,2);', labels: {} }
  const plot: MarkPlot = {
    marks: [],
    rows,
    facet: { field: 'PS', sort: ['a'] },
  }
  expect(splitOrder(plot, 'rows')).toBe('1, 2')
  expect(withSplitOrder(plot, 'rows', '2, 1').rows).toEqual({
    field: 'HP',
    sort: ['2', '1'],
    labels: {},
  })
  expect(withSplitOrder(plot, 'facet', '').facet).toEqual({ field: 'PS' })
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
