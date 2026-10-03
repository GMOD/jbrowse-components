import {
  REGION,
  createTestEnvironment,
  features,
  workerResult,
} from './testEnv.ts'

const FAMILY = features([
  { source: 'mom', start: 0, end: 400, score: 7 },
  { source: 'dad', start: 200, end: 800, score: 9 },
])

function loaded(rowColor: unknown) {
  const { display } = createTestEnvironment({
    marks: [{ mark: 'bar', encoding: { y: 'score' } }],
    rows: 'source',
    rowColor,
  }).createDisplay()
  display.setRpcData(0, workerResult(display, FAMILY), REGION)
  return display
}

const rowColorKey = (display: ReturnType<typeof loaded>) =>
  display.legendSpec.sections.find(s => s.id === 'rowColor')?.items ?? []

it('keys nothing by name, whose labels are the key', () => {
  const display = loaded({ domain: ['mom'], range: ['#00f'] })
  expect(display.resolvedRowColors.get('mom')).toBe('#00f')
  expect(display.rowColorScales).toEqual([])
  expect(rowColorKey(display)).toEqual([])
})

it('keys nothing by an attribute no row carries, and focuses nothing', () => {
  const display = loaded({ field: 'tissue' })
  expect(rowColorKey(display)).toEqual([])
  display.focusLegendEntry('rowColor', 'mom')
  expect(display.rowFocus).toBeUndefined()
})
