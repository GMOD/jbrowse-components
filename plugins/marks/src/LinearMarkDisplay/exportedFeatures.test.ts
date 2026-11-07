import {
  REGION,
  createTestEnvironment,
  features,
  workerResult,
} from './testEnv.ts'

import type { Feature } from '@jbrowse/core/util'

const names = (list: Feature[]) => list.map(f => f.get('name'))

function loaded(display: Record<string, unknown>, feats: Feature[]) {
  const { display: model } = createTestEnvironment(display).createDisplay()
  model.setRpcData(0, workerResult(model, feats), REGION)
  return model
}

const kindIs = (kind: string) => ({
  type: 'filter',
  expr: `jexl:get(feature,'kind') == '${kind}'`,
})

const FAMILY = features(
  [
    { name: 'lowScore', source: 'mom', kind: 'bar', tissue: 'liver', score: 1 },
    { name: 'bar', source: 'mom', kind: 'bar', tissue: 'liver', score: 5 },
    { name: 'point', source: 'dad', kind: 'point', tissue: 'brain', score: 5 },
    { name: 'depth', source: 'dad', kind: 'line', score: 5 },
    {
      name: 'rowLeftOut',
      source: 's2',
      kind: 'bar',
      tissue: 'liver',
      score: 5,
    },
    {
      name: 'hiddenTissue',
      source: 'mom',
      kind: 'bar',
      tissue: 'heart',
      score: 5,
    },
    { name: 'noMark', source: 'mom', kind: 'none', score: 5 },
  ].map((f, i) => ({ ...f, start: i * 100, end: i * 100 + 50 })),
)

test('the export is what some drawn mark reaches, in a kept row, outside a hidden category', () => {
  const display = loaded(
    {
      transform: [
        { type: 'formula', expr: "jexl:get(feature,'score') * 2", as: 's2' },
        { type: 'filter', expr: "jexl:get(feature,'s2') >= 6" },
      ],
      rows: { field: 'source', kept: ['mom', 'dad'] },
      marks: [
        {
          mark: 'bar',
          transform: [kindIs('bar')],
          encoding: {
            y: 'score',
            color: { field: 'tissue', scale: { type: 'ordinal' } },
          },
        },
        {
          mark: 'point',
          transform: [kindIs('point')],
          encoding: { y: 'score' },
        },
        {
          mark: 'bar',
          transform: [kindIs('line'), { type: 'coverage', as: 'depth' }],
          encoding: { y: 'depth' },
        },
      ],
    },
    FAMILY,
  )
  display.toggleCategory('tissue', ['heart'])

  expect(names(display.exportedFeatures(FAMILY))).toEqual([
    'bar',
    'point',
    'depth',
  ])
})

test('a feature in a hidden facet section is left out', () => {
  const display = loaded(
    { facet: { field: 'kind', hidden: ['point'] }, marks: [{ mark: 'rect' }] },
    FAMILY,
  )

  expect(names(display.exportedFeatures(FAMILY))).toEqual([
    'lowScore',
    'bar',
    'depth',
    'rowLeftOut',
    'hiddenTissue',
    'noMark',
  ])
})
