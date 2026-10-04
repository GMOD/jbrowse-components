import { bootAlignmentsDisplay } from './testUtils.ts'

function createDisplay(display: Record<string, unknown> = {}) {
  const { baseSession, mount } = bootAlignmentsDisplay({
    trackConfig: {
      displays: [
        { type: 'LinearAlignmentsDisplay', displayId: 'd1', ...display },
      ],
    },
  })
  const Session = baseSession.volatile(() => ({ rpcManager: {} }))
  return mount(Session, { configuration: 'd1' }).display
}

test('the coverage axis floors at 0 while scales.y.zero is on, and unticking Always include 0 lifts it', () => {
  const display = createDisplay()
  expect(display.minScoreBound).toBe(0)
  display.setScaleZero(false)
  expect(display.minScoreBound).toBeUndefined()
  expect(
    createDisplay({ scales: { y: { zero: false } } }).minScoreBound,
  ).toBeUndefined()
})

test('a pinned bottom stays pinned either way', () => {
  const display = createDisplay({
    scales: { y: { domainMin: 5, zero: false } },
  })
  expect(display.minScoreBound).toBe(5)
})

test("the corner notice reads scales.y's ends by the colour ramp's rule", () => {
  expect(
    createDisplay({ scales: { y: { domainMin: 50, domainMax: 5 } } }).notices,
  ).toEqual([
    'scales.y.domainMax: domainMax is below domainMin: the scale spans the two in order either way',
  ])
})
