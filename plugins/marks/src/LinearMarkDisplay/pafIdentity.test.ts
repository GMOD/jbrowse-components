import {
  REGION,
  createTestEnvironment,
  features,
  workerResult,
} from './testEnv.ts'

const ALIGNMENTS = features([
  { start: 0, end: 4000, identity: 0.97, mate: { assemblyName: 'Sakai' } },
  { start: 4000, end: 6000, identity: 0.82, mate: { assemblyName: 'Sakai' } },
  { start: 0, end: 5000, identity: 0.99, mate: { assemblyName: 'CFT073' } },
  { start: 7000, end: 8000, identity: 0.9, mate: { assemblyName: 'volvox' } },
])

const PER_GENOME = {
  transform: [
    { type: 'filter', expr: "jexl:feature.mate.assemblyName != 'volvox'" },
    {
      type: 'formula',
      expr: 'jexl:feature.mate.assemblyName',
      as: 'genome',
    },
    { type: 'formula', expr: 'jexl:feature.identity * 100', as: 'pid' },
  ],
  facet: 'genome',
  marks: [{ mark: 'rule', encoding: { y: 'pid', size: 3 } }],
}

test('a PAF faceted on its mate assembly draws each genome its identity rules', () => {
  const { display } = createTestEnvironment(PER_GENOME).createDisplay()
  display.setRpcData(0, workerResult(display, ALIGNMENTS), REGION)
  const { layers, facet } = display.rpcDataMap.get(0)!
  expect(facet?.map(s => s.key)).toEqual(['CFT073', 'Sakai'])
  const [rules] = layers
  expect([...rules!.x]).toEqual([0, 0, 4000])
  expect([...rules!.x2]).toEqual([5000, 4000, 6000])
  expect([...rules!.y!].map(v => Math.round(v))).toEqual([99, 97, 82])
  expect([...rules!.row!]).toEqual([0, 1, 1])
})
