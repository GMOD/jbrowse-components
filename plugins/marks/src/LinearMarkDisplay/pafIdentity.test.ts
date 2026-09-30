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
])

test('a PAF with rows on its mate assembly draws each genome its identity rules', () => {
  const { display } = createTestEnvironment({
    rows: 'mate.assemblyName',
    marks: [{ mark: 'rule', encoding: { y: 'identity' } }],
  }).createDisplay()
  display.setRpcData(0, workerResult(display, ALIGNMENTS), REGION)
  const { layers, facet } = display.rpcDataMap.get(0)!
  expect(facet?.map(s => s.key)).toEqual(['CFT073', 'Sakai'])
  const [rules] = layers
  expect([...rules!.x]).toEqual([0, 0, 4000])
  expect([...rules!.x2]).toEqual([5000, 4000, 6000])
  expect([...rules!.y!]).toEqual([0.99, 0.97, 0.82].map(Math.fround))
  expect(display.rowCount).toBe(2)
})
