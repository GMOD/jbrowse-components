import {
  REGION,
  createTestEnvironment,
  features,
  workerResult,
} from './testEnv.ts'

const READS = features([
  { start: 0, end: 100, strand: 1 },
  { start: 50, end: 150, strand: 1 },
  { start: 200, end: 300, strand: -1 },
])

test('a faceted coverage colours each section by the field it was split on', () => {
  const { display } = createTestEnvironment({
    facet: 'strand',
    marks: [
      {
        mark: 'bar',
        transform: [{ type: 'coverage' }],
        encoding: { color: 'strand' },
      },
    ],
  }).createDisplay()
  display.setRpcData(0, workerResult(display, READS), REGION)
  const layer = display.rpcDataMap.get(0)!.layers[0]!
  expect(layer.scale?.kind).toBe('categorical')
  expect(
    layer.scale?.kind === 'categorical' &&
      layer.scale.entries.map(e => e.value).sort(),
  ).toEqual(['-1', '1'])
  const [key] = display.colorScales
  expect(key?.kind === 'categorical' && key.entries.map(e => e.label)).toEqual([
    'Forward strand',
    'Reverse strand',
  ])
})
