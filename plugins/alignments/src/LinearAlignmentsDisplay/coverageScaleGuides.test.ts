import { setConf } from '@jbrowse/core/configuration'

import {
  bootAlignmentsDisplay,
  findMenuItem,
  makeEmptyAlignmentsResult,
  makeEmptyPileupData,
} from './testUtils.ts'

function coverageDisplay(depth: number, pileUp = depth) {
  console.warn = jest.fn()
  const { baseSession, mount } = bootAlignmentsDisplay()
  const asm = {
    initialized: true,
    regions: [
      { refName: 'ctgA', start: 0, end: 50_000, assemblyName: 'volvox' },
    ],
    getCanonicalRefName: (refName: string) => refName,
    getCanonicalRefName2: (refName: string) => refName,
  }
  const Session = baseSession.volatile(() => ({
    rpcManager: {
      call: jest.fn(() => Promise.resolve(makeEmptyAlignmentsResult())),
    },
    assemblyManager: {
      get: (name: string) => (name === 'volvox' ? asm : undefined),
      isValidRefName: () => true,
    },
  }))
  const { view, display } = mount(Session)
  setConf(display, 'coverageHeight', 200)
  view.setWidth(800)
  const region = {
    assemblyName: 'volvox',
    start: 0,
    end: 10_000,
    refName: 'ctgA',
  }
  view.setDisplayedRegions([region])
  display.setRpcData(
    0,
    {
      groups: [
        {
          key: '',
          label: '',
          data: {
            ...makeEmptyPileupData(),
            coverageDepths: new Float32Array(10_000)
              .fill(depth)
              .fill(pileUp, 100, 104),
            coverageMaxDepth: Math.max(depth, pileUp),
            coverageStartPos: 0,
          },
        },
      ],
    },
    region,
  )
  return display
}

function coverageAxis(display: ReturnType<typeof coverageDisplay>) {
  return display.axes.find(axis => axis.caption !== 'TLEN')!
}

test('a rule lands on the tick of the same depth, under symlog too', () => {
  for (const type of ['linear', 'log', 'symlog']) {
    const display = coverageDisplay(100)
    setConf(display, ['scales', 'y'], { type, domainMin: 0, domainMax: 100 })
    const { ticks } = coverageAxis(display)
    const tick = ticks.items.find(t => t.value !== 100 && t.value > 1)!
    setConf(display, ['scales', 'y', 'rules'], [tick.value])
    expect(coverageAxis(display).ruleMarks?.[0]?.y).toBeCloseTo(tick.y, 6)
  }
})

test('an autoscaled axis widens to a rule above the data, never below 0', () => {
  const display = coverageDisplay(10)
  const top = () => coverageAxis(display).domain[1]
  const bottom = () => coverageAxis(display).domain[0]
  expect(top()).toBeLessThan(40)
  setConf(display, ['scales', 'y', 'rules'], [40, -5])
  expect(top()).toBeGreaterThanOrEqual(40)
  expect(bottom()).toBe(0)
})

test('minimalTicks labels only the ends of the coverage axis', () => {
  const display = coverageDisplay(100)
  expect(coverageAxis(display).ticks.items.length).toBeGreaterThan(2)
  setConf(display, ['scales', 'y', 'minimalTicks'], true)
  expect(coverageAxis(display).ticks.items.map(t => t.value)).toEqual([
    0,
    coverageAxis(display).domain[1],
  ])
})

// The Coverage axis widget's Grid lines box writes this setter.
test('the grid setter reaches the coverage axis, and the menu offers the widget', () => {
  const display = coverageDisplay(100)
  expect(
    findMenuItem(display.trackMenuItems(), 'Coverage axis...'),
  ).toBeDefined()
  expect(coverageAxis(display).grid).toBe(false)
  display.setGrid(true)
  expect(coverageAxis(display).grid).toBe(true)
})

test('the autoscaled top reaches a pile-up until outliers are clipped', () => {
  const display = coverageDisplay(10, 1000)
  expect(coverageAxis(display).domain[1]).toBeGreaterThanOrEqual(1000)
  display.setDomainQuantile(display.clipQuantile)
  expect(coverageAxis(display).domain[1]).toBeLessThan(100)
})
