import createJexlInstance from '@jbrowse/core/util/jexl'

import { plotJexlExpressions, plotJexlProblems } from './plotProblems.ts'

const jexl = createJexlInstance()

test('finds the jexl in every channel, facet, filter, transform and label', () => {
  expect(
    plotJexlExpressions({
      encoding: {
        color: { value: 'jexl:a' },
        y: 'jexl:b',
        x2: { chrom: 'mate.refName', pos: 'jexl:c' },
        size: 4,
        text: 'name',
      },
      facet: { field: 'jexl:d' },
      filter: ['jexl:e', { field: 'jexl:e2', gte: 1 }],
      transform: [
        { type: 'filter', expr: 'jexl:f' },
        { type: 'formula', expr: 'jexl:g', as: 'h' },
        { type: 'coverage' },
      ],
      labels: { name: 'gene_name', description: 'jexl:i' },
    }),
  ).toEqual([
    { setting: 'encoding.color.value', code: 'jexl:a' },
    { setting: 'encoding.y', code: 'jexl:b' },
    { setting: 'encoding.x2.pos', code: 'jexl:c' },
    { setting: 'facet.field', code: 'jexl:d' },
    { setting: 'filter', code: 'jexl:e' },
    { setting: 'filter', code: 'jexl:e2' },
    { setting: 'transform[0].expr', code: 'jexl:f' },
    { setting: 'transform[1].expr', code: 'jexl:g' },
    { setting: 'labels.description', code: 'jexl:i' },
  ])
  expect(plotJexlExpressions({ facet: 'jexl:strand' })).toEqual([
    { setting: 'facet', code: 'jexl:strand' },
  ])
})

test('reports a syntax error and an unregistered function, nothing else', () => {
  expect(
    plotJexlProblems(
      {
        encoding: { color: 'jexl:feature.score >' },
        filter: ["jexl:startWith(get(feature,'name'),'BR')"],
        labels: { name: "jexl:get(feature,'name') == 3" },
      },
      jexl,
    ),
  ).toEqual([
    expect.stringMatching(
      /^encoding\.color: Unexpected end of expression.* \(column 21\)$/,
    ),
    expect.stringMatching(
      /^filter: no function startWith; did you mean .*startsWith/,
    ),
  ])
})
