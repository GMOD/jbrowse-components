import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { scaleTypeCode } from '@jbrowse/render-core/scoreScale'
import { COVERAGE_AXIS_LABEL } from '@jbrowse/wiggle-core'

import {
  emptyMafCoverage,
  emptyMafWireRegionData,
} from './components/coverageTestFixture.ts'
import { createMafTestEnvironment, stageDetailRegion } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// The coverage band reads the alignments display's scale and band settings:
// `scales.y` and the `coverage` band's filter and interbase marks.
function displayWith(displayConfig: Record<string, unknown> = {}) {
  const { display } = createMafTestEnvironment({
    displayConfig,
  }).createDisplay()
  const depths = Array.from({ length: 200 }, (_, i) => 10 + (i % 7))
  stageDetailRegion(display, 0, {
    ...emptyMafWireRegionData(),
    coverage: {
      ...emptyMafCoverage(0),
      coverageDepths: Float32Array.from(depths),
      coverageMaxDepth: Math.max(...depths),
    },
  })
  return display
}

function labels(items: MenuItem[]) {
  return items.flatMap(i => ('label' in i ? [i.label] : []))
}

test('a default band is linear from zero, every mismatch and insertion drawn', () => {
  const display = displayWith()
  const domain = display.coverageDepthDomain!
  expect(domain[0]).toBe(0)
  expect(domain[1]).toBeGreaterThanOrEqual(16)
  expect(display.coverageBandState).toMatchObject({
    domainMin: 0,
    domainMax: domain[1],
    scaleType: scaleTypeCode('linear'),
    minAlleleFraction: 0,
    showInterbase: true,
  })
  expect(display.axes[0]!.domain).toEqual(domain)
})

test('scales.y reaches the band, its axis and its marks alike', () => {
  const display = displayWith({ scales: { y: { type: 'log' } } })
  const domain = display.coverageDepthDomain!
  expect(domain[0]).toBeGreaterThanOrEqual(1)
  expect(display.coverageBandState.scaleType).toBe(scaleTypeCode('log'))
  expect(display.axes[0]!.scaleType).toBe('log')
})

test('a pinned maximum pins the band', () => {
  const display = displayWith()
  display.setMaxScore(100)
  expect(display.coverageDepthDomain).toEqual([0, 100])
  expect(display.coverageBandState.domainMax).toBe(100)
})

test('the SNP floor and the interbase toggle reach the band', () => {
  const display = displayWith({
    coverage: { minAlleleFraction: 0.2 },
  })
  expect(display.coverageBandState.minAlleleFraction).toBe(0.2)
  display.setShowInterbaseIndicators(false)
  expect(display.coverageBandState.showInterbase).toBe(false)
})

test('the zoomed-out tooltip snaps past a SNP under the floor, as the band skips it', () => {
  const { display } = createMafTestEnvironment({
    displayConfig: { coverage: { minAlleleFraction: 0.2 } },
  }).createDisplay()
  const A = 'A'.charCodeAt(0)
  stageDetailRegion(display, 0, {
    ...emptyMafWireRegionData(),
    coverage: {
      ...emptyMafCoverage(0),
      coverageDepths: new Float32Array(8).fill(10),
      coverageMaxDepth: 10,
      mismatchPositions: Uint32Array.from([3, 6, 6, 6, 6, 6]),
      mismatchBases: new Uint8Array(6).fill(A),
    },
  })
  expect(display.coverageTooltipBin(0, 0, 8)?.position).toBe(6)
})

test('rules belong to the coverage scale, not the fixed conservation one', () => {
  const display = displayWith({
    coverage: { show: false },
    conservation: { show: true },
  })
  expect(display.valueScales).toHaveLength(1)
  expect(display.scoreRulesDrawn).toBe(false)
  display.setShowCoverage(true)
  expect(display.scoreRulesDrawn).toBe(true)
})

test('the interbase toggle greys out with the band hidden', () => {
  const display = displayWith({ coverage: { show: false } })
  const row = display
    .trackMenuItems()
    .flatMap(i => ('subMenu' in i ? resolveSubMenu(i) : [i]))
    .find(i => 'label' in i && i.label === 'Interbase indicators')
  expect(row && 'disabled' in row && row.disabled).toBe(true)
})

test('the track menu offers the shared coverage rows', () => {
  const display = displayWith()
  expect(labels(display.trackMenuItems())).toEqual(
    expect.arrayContaining([
      `${COVERAGE_AXIS_LABEL}...`,
      'Color SNPs above...',
    ]),
  )
})
