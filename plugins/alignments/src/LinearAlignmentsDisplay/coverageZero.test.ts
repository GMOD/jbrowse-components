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

test('the coverage axis floors at 0 while its scale.zero is on, and unticking Always include 0 lifts it', () => {
  const display = createDisplay()
  expect(display.minScoreBound).toBe(0)
  display.setScaleZero(false)
  expect(display.minScoreBound).toBeUndefined()
  expect(
    createDisplay({ coverage: { encoding: { y: { scale: { zero: false } } } } })
      .minScoreBound,
  ).toBeUndefined()
})

test('a pinned bottom stays pinned either way', () => {
  const display = createDisplay({
    coverage: {
      encoding: { y: { scale: { domainMin: 5, zero: false } } },
    },
  })
  expect(display.minScoreBound).toBe(5)
})

test("the corner notice reads the coverage scale's ends by the color ramp's rule", () => {
  expect(
    createDisplay({
      coverage: {
        encoding: {
          y: { scale: { domainMin: 50, domainMax: 5, fenceQuantile: 99 } },
        },
      },
    }).notices,
  ).toEqual([
    'coverage.encoding.y.scale.domainMax: domainMax is below domainMin: the scale spans the two in order either way',
    expect.stringMatching(
      /^coverage\.encoding\.y\.scale\.fenceQuantile: fenceQuantile is a fraction/,
    ),
  ])
})

test('a v5 scales.y lands on the coverage axis, minimalTicks let go', () => {
  const display = createDisplay({
    scales: {
      y: {
        domainMin: 5,
        zero: false,
        symlogConstant: 2,
        autoscaleGroup: 'depth',
        domainQuantile: 0.99,
        grid: true,
        minimalTicks: true,
        rules: [30],
      },
    },
  })
  expect(display.minScoreBound).toBe(5)
  expect(display.symlogConstant).toBe(2)
  expect(display.autoscaleGroup).toBe('depth')
  expect(display.fenceQuantile).toBe(0.99)
  expect(display.grid).toBe(true)
  expect(display.configuration.coverage.encoding.y.axis).not.toHaveProperty(
    'minimalTicks',
  )
  expect(display.scoreRules).toEqual([{ value: 30 }])
})
